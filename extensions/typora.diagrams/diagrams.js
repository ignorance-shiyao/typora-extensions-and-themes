// Offline diagrams — a static fence renderer (docs/extensions.md §6.3):
// Typora sends the fence source, this draws it with a bundled library and
// returns SVG. Nothing leaves the computer. Each library loads the first
// time its language is drawn.

const view = typora.view;

const scripts = new Map();

/** Load vendor scripts in order, once. */
function load(...paths) {
  return paths.reduce(
    (previous, path) =>
      previous.then(() => {
        let pending = scripts.get(path);
        if (!pending) {
          pending = new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = path;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`Could not load ${path}.`));
            document.head.append(script);
          });
          scripts.set(path, pending);
        }
        return pending;
      }),
    Promise.resolve(),
  );
}

function parseJson(source, what) {
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(`${what} must be JSON: ${error.message}`);
  }
}

/** Drop the XML prolog and DOCTYPE some libraries put before <svg>. */
function svgOnly(markup) {
  const start = markup.indexOf("<svg");
  if (start < 0) throw new Error("The library did not return SVG.");
  return markup.slice(start);
}

// ── Graphviz (and erd, through Graphviz) ──────────────────────────────

let graphvizLibrary = null;

/** Where the body of the first graph starts: after its `{`, skipping comments and strings. */
function graphBodyStart(source) {
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '"') {
      for (i++; i < source.length && source[i] !== '"'; i++) if (source[i] === "\\") i++;
    } else if (c === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i++;
    } else if (c === "/" && source[i + 1] === "*") {
      const end = source.indexOf("*/", i + 2);
      i = end < 0 ? source.length : end + 1;
    } else if (c === "#" && (i === 0 || source[i - 1] === "\n")) {
      while (i < source.length && source[i] !== "\n") i++;
    } else if (c === "<") {
      // An HTML-like ID before the body: <…> with nested <>.
      for (let depth = 0; i < source.length; i++) {
        if (source[i] === "<") depth++;
        else if (source[i] === ">" && --depth === 0) break;
      }
    } else if (c === "{") return i + 1;
  }
  return -1;
}

async function graphviz(source, theme) {
  // An absolute URL: in the sandboxed page a relative import() has no base.
  graphvizLibrary ??= import(new URL("vendor/graphviz.js", document.baseURI).href).then(({ Graphviz }) => Graphviz.load());
  graphvizLibrary.catch(() => (graphvizLibrary = null));
  const library = await graphvizLibrary;
  // Theme colors as the graph's first statements: anything the source sets
  // later wins.
  const fg = JSON.stringify(theme.foreground);
  const defaults = `graph [bgcolor=transparent, color=${fg}, fontcolor=${fg}]; node [color=${fg}, fontcolor=${fg}]; edge [color=${fg}, fontcolor=${fg}];`;
  const start = graphBodyStart(source);
  const themed = start < 0 ? source : `${source.slice(0, start)} ${defaults}${source.slice(start)}`;
  let svg;
  try {
    svg = library.dot(themed);
  } catch (error) {
    throw new Error(String(error.message || error).trim() || "Graphviz could not draw this graph.");
  }
  if (!svg) throw new Error("Graphviz could not draw this graph.");
  return svgOnly(svg);
}

function erd(source, theme) {
  return graphviz(erdToDot(source, theme), theme);
}

// ── Vega / Vega-Lite ──────────────────────────────────────────────────

function vegaConfig(theme) {
  const fg = theme.foreground;
  const grid = theme.border;
  return {
    background: null,
    axis: { labelColor: fg, titleColor: fg, domainColor: fg, tickColor: fg, gridColor: grid },
    legend: { labelColor: fg, titleColor: fg },
    title: { color: fg, subtitleColor: fg },
    header: { labelColor: fg, titleColor: fg },
    view: { stroke: grid },
    style: { "guide-label": { fill: fg }, "guide-title": { fill: fg }, "group-title": { fill: fg } },
  };
}

async function drawVega(spec, theme) {
  // The page's CSP forbids generated code: the interpreter evaluates
  // expressions instead (vega.github.io/vega/usage/interpreter/).
  const runtime = vega.parse(spec, vegaConfig(theme), { ast: true });
  const chart = new vega.View(runtime, { renderer: "none", expr: vegaInterpreter.expressionInterpreter });
  try {
    return svgOnly(await chart.toSVG());
  } finally {
    chart.finalize();
  }
}

async function vegaSpec(source, theme) {
  await load("vendor/vega.min.js", "vendor/vega-interpreter.js");
  return drawVega(parseJson(source, "A Vega spec"), theme);
}

async function vegaLiteSpec(source, theme) {
  await load("vendor/vega.min.js", "vendor/vega-interpreter.js", "vendor/vega-lite.min.js");
  const spec = parseJson(source, "A Vega-Lite spec");
  return drawVega(vegaLite.compile(spec, { config: vegaConfig(theme) }).spec, theme);
}

// ── WaveDrom ──────────────────────────────────────────────────────────

let waveId = 0;

async function waveDrom(source, theme) {
  await load("vendor/wavedrom.unpkg.min.js", "vendor/wavedrom-dark.js");
  let spec;
  try {
    // WaveJSON is JSON5-ish: unquoted keys, single quotes, trailing commas.
    spec = relaxedJson(source);
  } catch (error) {
    throw new Error(`Cannot read the WaveJSON: ${error.message}`);
  }
  const skins = { ...wavedrom.waveSkin, ...self.WaveSkin };
  if (theme.dark && !spec?.config?.skin && skins.dark) spec = { ...spec, config: { ...spec.config, skin: "dark" } };
  const tree = wavedrom.renderAny(waveId++, spec, skins);
  // WaveDrom paints a white backdrop under every drawing; the page's own
  // background (and the dark skin) should show instead.
  return svgOnly(wavedrom.onml.stringify(tree)).replace(/<rect width="[\d.]+" height="[\d.]+" style="stroke:none;fill:white"\/>/, "");
}

/**
 * WaveJSON as people write it: `{ signal: [{ name: 'clk', wave: 'p...' }] }`.
 * Quotes bare keys and single-quoted strings, drops comments and trailing
 * commas, then parses it as JSON (no eval).
 */
function relaxedJson(source) {
  let out = "";
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    if (c === '"' || c === "'") {
      let j = i + 1;
      let text = "";
      while (j < source.length && source[j] !== c) {
        if (source[j] === "\\") {
          text += source[j] + source[j + 1];
          j += 2;
        } else text += source[j++];
      }
      out += JSON.stringify(c === '"' ? JSON.parse(`"${text}"`) : text.replace(/\\'/g, "'"));
      i = j + 1;
    } else if (c === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i++;
    } else if (c === "/" && source[i + 1] === "*") {
      const end = source.indexOf("*/", i + 2);
      i = end < 0 ? source.length : end + 2;
    } else if (/[A-Za-z_$]/.test(c)) {
      let j = i;
      while (j < source.length && /[\w$]/.test(source[j])) j++;
      const word = source.slice(i, j);
      const next = source.slice(j).match(/^\s*(.)/)?.[1];
      out += next === ":" ? JSON.stringify(word) : word;
      i = j;
    } else {
      out += c;
      i++;
    }
  }
  return JSON.parse(out.replace(/,(\s*[\]}])/g, "$1"));
}

// ── nomnoml ───────────────────────────────────────────────────────────

async function nomnomlDiagram(source, theme) {
  await load("vendor/graphre.js", "vendor/nomnoml.js");
  // Directives in the source come later and win.
  const defaults = theme.dark ? `#stroke: ${theme.foreground}\n#fill: ${theme.panel}; ${theme.background}\n` : "";
  try {
    return svgOnly(nomnoml.renderSvg(defaults + source));
  } catch (error) {
    throw new Error(error.message || String(error));
  }
}

// ── BPMN ──────────────────────────────────────────────────────────────

async function bpmn(source, theme) {
  await load("vendor/bpmn-viewer.production.min.js");
  const container = document.createElement("div");
  container.style.cssText = "position:absolute;inset:0;";
  document.body.append(container);
  const viewer = new BpmnJS({
    container,
    bpmnRenderer: theme.dark
      ? { defaultFillColor: theme.background, defaultStrokeColor: theme.foreground, defaultLabelColor: theme.foreground }
      : {},
  });
  try {
    await viewer.importXML(source);
    const { svg } = await viewer.saveSVG();
    return withBpmnIoMark(svgOnly(svg), theme);
  } catch (error) {
    throw new Error(error.message || String(error));
  } finally {
    viewer.destroy();
    container.remove();
  }
}

/**
 * bpmn-js's license asks that rendered diagrams keep the bpmn.io mark
 * visible. Its viewer draws the mark as an overlay that the exported SVG
 * leaves out, so add it to the drawing.
 */
function withBpmnIoMark(svg, theme) {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = doc.documentElement;
  const [x, y, width, height] = (root.getAttribute("viewBox") ?? "0 0 0 0").split(/\s+/).map(Number);
  const pad = 14;
  const grow = (value, by) => String(Number.parseFloat(value) + by);
  root.setAttribute("viewBox", `${x} ${y} ${width} ${height + pad}`);
  if (root.hasAttribute("height")) root.setAttribute("height", grow(root.getAttribute("height"), pad));
  const mark = doc.createElementNS("http://www.w3.org/2000/svg", "text");
  mark.setAttribute("x", String(x + width));
  mark.setAttribute("y", String(y + height + pad - 2));
  mark.setAttribute("text-anchor", "end");
  mark.setAttribute("font-size", "9");
  mark.setAttribute("font-family", "Arial, sans-serif");
  mark.setAttribute("fill", theme.foreground);
  mark.setAttribute("opacity", "0.5");
  mark.textContent = "Powered by bpmn.io";
  root.append(mark);
  return new XMLSerializer().serializeToString(root);
}

// ── Dispatch ──────────────────────────────────────────────────────────

const RENDERERS = {
  graphviz,
  dot: graphviz,
  erd,
  vega: vegaSpec,
  vegalite: vegaLiteSpec,
  "vega-lite": vegaLiteSpec,
  wavedrom: waveDrom,
  nomnoml: nomnomlDiagram,
  bpmn,
};

view.onRender(async ({ source, lang, theme }) => {
  const draw = RENDERERS[lang];
  if (!draw) throw new Error(`No renderer for ${lang}.`);
  if (!source.trim()) throw new Error("The diagram is empty.");
  return { svg: await draw(source, theme) };
});
