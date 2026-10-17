// A small front matter editor: reads and replaces top-level keys of a
// document's YAML front matter and leaves every other line (comments, nested
// maps, other keys) exactly as written. Not a YAML parser.

const KEY_LINE = /^([A-Za-z0-9_][^:#\s]*(?:[ \t]+[^:#\s]+)*)[ \t]*:(?=[ \t]|$)(.*)$/;

/** `{ bom, eol, lines, close, body, exists }` — `lines` are the YAML lines between the fences. */
export function splitFrontMatter(markdown) {
  const bom = markdown.startsWith("\ufeff") ? "\ufeff" : "";
  const text = markdown.slice(bom.length);
  const eol = /\r\n/.test(text.slice(0, text.indexOf("\n") + 1)) ? "\r\n" : "\n";
  const first = /^---[ \t]*\r?\n/.exec(text);
  if (first) {
    const lines = [];
    let at = first[0].length;
    while (at <= text.length) {
      const end = text.indexOf("\n", at);
      const raw = end === -1 ? text.slice(at) : text.slice(at, end + 1);
      const line = raw.replace(/\r?\n$/, "");
      if (/^(---|\.\.\.)[ \t]*$/.test(line)) {
        return { bom, eol, lines, close: line.trim(), body: text.slice(at + raw.length), exists: true, closed: end !== -1 };
      }
      lines.push(line);
      if (end === -1) break;
      at = end + 1;
    }
  }
  return { bom, eol, lines: [], close: "---", body: text, exists: false, closed: true };
}

export function joinFrontMatter(fm) {
  if (!fm.exists && fm.lines.length === 0) return fm.bom + fm.body;
  const head = ["---", ...fm.lines, fm.close].join(fm.eol);
  return fm.bom + head + (fm.closed || fm.body ? fm.eol : "") + fm.body;
}

/** Top-level entries: `{ key, start, end }` line ranges (end exclusive). */
function entries(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = KEY_LINE.exec(lines[i]);
    if (!m) continue;
    let end = i + 1;
    // The value continues over indented lines and block-list items; blank
    // lines belong to it only when more of it follows.
    for (let j = i + 1; j < lines.length; j++) {
      if (/^([ \t]+\S|-([ \t]|$))/.test(lines[j])) end = j + 1;
      else if (/^[ \t]*$/.test(lines[j])) continue;
      else break;
    }
    out.push({ key: m[1], start: i, end, inline: m[2] });
    i = end - 1;
  }
  return out;
}

function stripComment(value) {
  const v = value.trim();
  if (v.startsWith('"') || v.startsWith("'")) return v;
  return v.replace(/[ \t]+#.*$/, "").trim();
}

export function unquote(value) {
  const v = stripComment(value);
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"'))
    return v.slice(1, -1).replace(/\\(["\\nt])/g, (_, c) => (c === "n" ? "\n" : c === "t" ? "\t" : c));
  if (v.length >= 2 && v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
  const quoted = /^(["'])(.*)\1/.exec(v);
  if (quoted) return unquote(quoted[0]);
  return v;
}

/** Items of a flow list body (`a, "b, c", d`). */
function splitFlow(inner) {
  const items = [];
  let current = "";
  let quote = null;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (quote) {
      current += c;
      if (c === quote && !(quote === '"' && inner[i - 1] === "\\")) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
      current += c;
    } else if (c === ",") {
      items.push(current);
      current = "";
    } else current += c;
  }
  items.push(current);
  return items.map(unquote).filter((item) => item !== "");
}

/** A key's value: a string, a list of strings, or undefined when missing. Nested maps come back as "". */
export function getKey(fm, key) {
  const entry = entries(fm.lines).find((e) => e.key === key);
  if (!entry) return undefined;
  const inline = stripComment(entry.inline);
  if (inline.startsWith("[")) return splitFlow(inline.replace(/^\[/, "").replace(/\]\s*$/, ""));
  if (inline) return unquote(inline);
  const items = fm.lines
    .slice(entry.start + 1, entry.end)
    .map((line) => /^[ \t]*-[ \t]+(.*)$/.exec(line))
    .filter(Boolean)
    .map((m) => unquote(m[1]));
  return items.length ? items : "";
}

/** How an existing list is written: `{ flow }` or `{ indent }` for a block list; null if not a list. */
function listStyleOf(fm, entry) {
  if (stripComment(entry.inline).startsWith("[")) return { flow: true };
  const item = fm.lines.slice(entry.start + 1, entry.end).find((line) => /^[ \t]*-([ \t]|$)/.test(line));
  return item ? { flow: false, indent: /^[ \t]*/.exec(item)[0] } : null;
}

const PLAIN_UNSAFE = /^[-?:,\[\]{}#&*!|>'"%@`]|^\s|\s$|: |:$| #|^(true|false|yes|no|on|off|null|~)$|^[-+]?(\d[\d_]*(\.\d*)?|\.\d+)([eE][-+]?\d+)?$|^0[xo]/i;

/** A YAML scalar, quoted only when it has to be. */
export function quote(value, inFlow = false) {
  const s = String(value);
  if (s === "" || PLAIN_UNSAFE.test(s) || /[\n\r\t]/.test(s) || (inFlow && /[,\[\]{}]/.test(s)))
    return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\t/g, "\\t")}"`;
  return s;
}

/**
 * Set a key to a string or a list. Lists keep the style of the value they
 * replace; new lists use `listStyle` ("flow" or "block"). A new key is
 * added at the end, or at the start with `first`.
 */
export function setKey(fm, key, value, { listStyle = "flow", first = false } = {}) {
  const entry = entries(fm.lines).find((e) => e.key === key);
  let rendered;
  if (Array.isArray(value)) {
    const style = (entry && listStyleOf(fm, entry)) ?? (listStyle === "block" ? { flow: false, indent: "  " } : { flow: true });
    rendered = style.flow
      ? [`${key}: [${value.map((v) => quote(v, true)).join(", ")}]`]
      : value.length
        ? [`${key}:`, ...value.map((v) => `${style.indent}- ${quote(v)}`)]
        : [`${key}: []`];
  } else rendered = [`${key}: ${quote(value)}`];
  const lines = [...fm.lines];
  if (entry) lines.splice(entry.start, entry.end - entry.start, ...rendered);
  else if (first) lines.splice(0, 0, ...rendered);
  else {
    let at = lines.length;
    while (at > 0 && /^[ \t]*$/.test(lines[at - 1])) at--;
    lines.splice(at, 0, ...rendered);
  }
  return { ...fm, lines, exists: true };
}

/** Apply `{ key: value }` changes to a whole Markdown text. A new `title` goes first. */
export function updateFrontMatter(markdown, changes, options = {}) {
  let fm = splitFrontMatter(markdown);
  for (const [key, value] of Object.entries(changes)) fm = setKey(fm, key, value, { ...options, first: key === "title" });
  return joinFrontMatter(fm);
}
