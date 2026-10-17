// PlantUML and ditaa — a static fence renderer (docs/extensions.md §6.3).
//
// Draws with PlantUML on this computer (the `plantuml` command, or Java with
// plantuml.jar) or with a Kroki server, as set in the extension's options.
// PlantUML runs in pipe mode and stays up between diagrams, so only the
// first one waits for Java to start; it quits after a minute without work.

const view = typora.view;

const DELIMITER = "__TYPORA_PLANTUML_END__";
const DELIMITER_BYTES = new TextEncoder().encode(DELIMITER);
const IDLE_MS = 60_000;
const RENDER_TIMEOUT_MS = 25_000;
const PROCESS_NAME = "plantuml";

// ── Settings ──────────────────────────────────────────────────────────

async function settings() {
  const raw = await view.settings();
  const text = (key, fallback) => (typeof raw[key] === "string" && raw[key].trim() ? raw[key].trim() : fallback);
  return {
    backend: ["command", "java", "kroki"].includes(raw.backend) ? raw.backend : "command",
    command: text("command", "plantuml"),
    java: text("java", "java"),
    jar: text("jar", ""),
    server: text("server", "https://kroki.io").replace(/\/+$/, ""),
  };
}

// ── Sources ───────────────────────────────────────────────────────────

/** PlantUML needs `@start…`/`@end…` around a diagram in pipe mode. */
function wrap(source, lang) {
  const body = source.replace(/\s+$/, "");
  if (/^\s*@start\w+/m.test(body)) return `${body}\n`;
  const kind = lang === "ditaa" ? "ditaa" : "uml";
  return `@start${kind}\n${body}\n@end${kind}\n`;
}

/** Diagrams in a source: PlantUML answers once for each. */
function diagramCount(source) {
  return Math.max(1, (source.match(/^\s*@start\w+/gm) ?? []).length);
}

// ── Output ────────────────────────────────────────────────────────────

const decoder = new TextDecoder();

function base64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** ditaa only draws PNG: wrap it in an SVG at its own size. */
function pngAsSvg(png) {
  const signature = [0x89, 0x50, 0x4e, 0x47];
  if (png.length < 24 || signature.some((b, i) => png[i] !== b)) throw new Error("PlantUML did not return an image.");
  const view32 = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const width = view32.getUint32(16);
  const height = view32.getUint32(20);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<image width="${width}" height="${height}" href="data:image/png;base64,${base64(png)}"/></svg>`
  );
}

function svgFrom(bytes) {
  const text = decoder.decode(bytes);
  const start = text.indexOf("<svg");
  if (start < 0) throw new Error(text.trim().split("\n")[0] || "PlantUML did not return SVG.");
  return text.slice(start, text.lastIndexOf("</svg>") + 6);
}

// ── PlantUML on this computer ─────────────────────────────────────────

function indexOf(haystack, needle, from) {
  outer: for (let i = Math.max(0, from); i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (haystack[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

function concat(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
}

/**
 * The line of Java's complaint worth showing: "UnsupportedClassVersionError:
 * … compiled by a more recent version …", "Unable to access jarfile …".
 */
function javaError(stderr) {
  const lines = stderr.split("\n").map((line) => line.trim()).filter(Boolean);
  const line = lines.find((l) => /(Error|Exception)\b.*:|^Error:|Unable to access/.test(l) && !/^at /.test(l)) ?? lines.find((l) => !/^at /.test(l));
  const message = line?.replace(/^Exception in thread "main" /, "") ?? "";
  return /UnsupportedClassVersionError/.test(message) ? `${message} — PlantUML needs Java 11 or later.` : message;
}

/** One PlantUML in pipe mode: answers diagrams in order, split by DELIMITER. */
class PlantUmlProcess {
  constructor(command, args) {
    this.command = command;
    this.args = args;
    this.handle = null;
    this.buffer = new Uint8Array(0);
    this.errors = "";
    this.waiting = [];
    this.queue = Promise.resolve();
    this.idleTimer = 0;
    this.dead = false;
  }

  async start() {
    try {
      this.handle = await view.process.spawn(this.command, this.args, { name: PROCESS_NAME });
    } catch (error) {
      this.dead = true;
      throw new Error(`Could not run ${this.command}: ${error.message}`);
    }
    this.handle.onData((bytes, stream) => {
      if (stream === "stderr") {
        this.errors = (this.errors + decoder.decode(bytes)).slice(-4000);
        return;
      }
      this.buffer = concat(this.buffer, bytes);
      this.drain();
    });
    this.handle.onExit(({ code }) => {
      this.dead = true;
      this.exitError = new Error(javaError(this.errors) || `${this.command} stopped (exit code ${code}).`);
      for (const waiter of this.waiting.splice(0)) waiter.reject(this.exitError);
    });
  }

  drain() {
    while (this.waiting.length) {
      const at = indexOf(this.buffer, DELIMITER_BYTES, 0);
      if (at < 0) return;
      const answer = this.buffer.slice(0, at);
      let next = at + DELIMITER_BYTES.length;
      while (this.buffer[next] === 0x0d || this.buffer[next] === 0x0a) next++;
      this.buffer = this.buffer.slice(next);
      this.waiting.shift().resolve(answer);
    }
  }

  /** The answers to one source (one per @start… in it). */
  render(text, count) {
    const run = this.queue.then(async () => {
      if (this.dead) throw this.exitError ?? new Error("PlantUML stopped.");
      clearTimeout(this.idleTimer);
      this.errors = "";
      const answers = Array.from(
        { length: count },
        () => new Promise((resolve, reject) => this.waiting.push({ resolve, reject })),
      );
      const timer = setTimeout(() => this.stop(), RENDER_TIMEOUT_MS);
      try {
        await this.handle.write(text);
        return await Promise.all(answers);
      } finally {
        clearTimeout(timer);
        this.idleTimer = setTimeout(() => this.stop(), IDLE_MS);
      }
    });
    this.queue = run.catch(() => {});
    return run;
  }

  stop() {
    if (this.dead) return;
    this.dead = true;
    clearTimeout(this.idleTimer);
    const error = new Error("PlantUML took too long and was stopped.");
    for (const waiter of this.waiting.splice(0)) waiter.reject(error);
    void this.handle?.kill().catch(() => {});
  }
}

/** Running PlantUMLs by command line: light, dark, PNG for ditaa. */
const processes = new Map();

async function localRender(config, source, lang, dark) {
  if (config.backend === "java" && !config.jar)
    throw new Error("Choose plantuml.jar in Settings ▸ Extensions ▸ PlantUML, or draw with the plantuml command or Kroki.");
  const format = lang === "ditaa" ? "-tpng" : "-tsvg";
  const flags = [format, "-pipe", "-charset", "UTF-8", "-pipedelimitor", DELIMITER, ...(dark && lang !== "ditaa" ? ["-darkmode"] : [])];
  const [command, args] =
    config.backend === "java"
      ? [config.java, ["-Djava.awt.headless=true", "-jar", config.jar, ...flags]]
      : [config.command, flags];
  const key = JSON.stringify([command, args]);
  let plantuml = processes.get(key);
  if (!plantuml || plantuml.dead) {
    const started = new PlantUmlProcess(command, args);
    started.ready = stale.then(() => started.start());
    processes.set(key, started);
    plantuml = started;
  }
  await plantuml.ready;
  const text = wrap(source, lang);
  const [first] = await plantuml.render(text, diagramCount(text));
  if (!first.length) throw new Error(plantuml.errors.trim() || "PlantUML returned nothing.");
  return lang === "ditaa" ? pngAsSvg(first) : svgFrom(first);
}

// ── Kroki ─────────────────────────────────────────────────────────────

async function krokiRender(config, source, lang) {
  const url = `${config.server}/${lang === "ditaa" ? "ditaa" : "plantuml"}/svg`;
  let response;
  try {
    response = await view.fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain; charset=utf-8", Accept: "image/svg+xml" },
      body: source,
    });
  } catch (error) {
    throw new Error(`${error.message} (Kroki server ${config.server})`);
  }
  const text = await response.text();
  if (!response.ok) throw new Error(text.trim().split("\n")[0] || `${config.server} answered ${response.status}.`);
  return text;
}

// ── Rendering ─────────────────────────────────────────────────────────

const cache = new Map();

view.onRender(async ({ source, lang, theme }) => {
  if (!source.trim()) throw new Error("The diagram is empty.");
  const kind = lang === "ditaa" ? "ditaa" : "plantuml";
  const config = await settings();
  const dark = config.backend !== "kroki" && theme.dark;
  const key = JSON.stringify([config, kind, dark, source]);
  const cached = cache.get(key);
  if (cached) return { svg: cached };
  const svg = config.backend === "kroki" ? await krokiRender(config, source, kind) : await localRender(config, source, kind, dark);
  cache.set(key, svg);
  if (cache.size > 100) cache.delete(cache.keys().next().value);
  return { svg };
});

/**
 * A PlantUML left running by an earlier copy of this page (the extension
 * reloaded) has lost its idle timer: stop it before starting our own.
 */
const stale = view.process
  .list()
  .then((running) => running.filter((p) => p.name === PROCESS_NAME && p.running))
  .then((found) => Promise.all(found.map((p) => view.process.attach(p.id).then((h) => h.kill()))))
  .catch(() => {});
