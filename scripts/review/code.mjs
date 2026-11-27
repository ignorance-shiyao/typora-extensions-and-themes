// Source checks for one package (CONTRIBUTING.md, "Automated checks"):
//
// - the module graph from every entry (main, background, pages, MathJax
//   packages): every import and src exists with this exact case, stays in the
//   package, and is not a bare name or a URL;
// - pages: no inline scripts or handlers and no remote resources, which the
//   page CSP (docs/extensions.md §7.1) blocks, so they would not work;
// - code rules on the package's own sources (vendored files registered in
//   .typora/vendor.json are exempt): no eval, no Function constructor, no
//   remote code, no minified or obfuscated sources;
// - the SDK calls against the permissions: a call the manifest does not allow
//   fails at run time; a permission nothing uses should not be asked for.

import * as acorn from "acorn";
import * as walk from "acorn-walk";
import { readFileSync } from "node:fs";
import { join, posix } from "node:path";
import { normalizePermissions } from "../lib.mjs";

const MINIFIED_LINE = 1000;
const ENCODED_LITERAL = 2048;
const OBFUSCATED_NAMES = 20;

/** The SDK path each permission guards (worker `typora.*` and page `typora.view.*`). */
export const API_PERMISSIONS = [
  { prefix: "typora.net.fetch", needs: "network" },
  { prefix: "typora.view.fetch", needs: "network" },
  { prefix: "typora.editor.getSelection", needs: "document:read" },
  { prefix: "typora.editor.getMarkdown", needs: "document:read" },
  { prefix: "typora.editor.insertMarkdown", needs: "document:write" },
  { prefix: "typora.editor.replaceRange", needs: "document:write" },
  { prefix: "typora.editor.replaceDocument", needs: "document:write" },
  { prefix: "typora.document.getBlocks", needs: "document:read" },
  { prefix: "typora.document.readImage", needs: "document:read" },
  { prefix: "typora.publish.current", needs: "document:read" },
  { prefix: "typora.workspace", needs: "workspace" },
  { prefix: "typora.sync.notifyStatusChanged", needs: "workspace" },
  { prefix: "typora.clipboard", needs: "clipboard" },
  { prefix: "typora.ai", needs: "ai", only: ["main"] },
  { prefix: "typora.process", needs: "process", only: ["main"] },
  { prefix: "typora.view.process", needs: "process", only: ["page"] },
  { prefix: "typora.view.onDocument", needs: "document:read", only: ["page"] },
  { prefix: "typora.view.insertMarkdown", needs: "document:write", only: ["page"] },
];

const GLOBAL_OBJECTS = new Set(["window", "self", "globalThis", "global"]);

/**
 * SDK calls recognised by shape when the SDK object was handed around
 * (`createIndex(typora)` → `api.workspace.folders()`), so passing it to
 * another function does not hide a call from the review.
 */
const SHAPES = {
  net: ["fetch"],
  editor: ["getSelection", "getMarkdown", "insertMarkdown", "replaceRange", "replaceDocument"],
  document: ["getBlocks", "readImage"],
  publish: ["current"],
  workspace: ["folders", "listFiles", "readFile"],
  sync: ["notifyStatusChanged"],
  clipboard: ["readText", "writeText"],
  ai: ["status", "complete"],
  process: ["spawn", "list", "attach", "info"],
};
/** Browser objects with members of the same names. */
const NOT_SDK = new Set(["navigator", "window", "self", "globalThis", "document"]);

function granted(perms, need) {
  if (need === "document:read") return !!perms.document;
  if (need === "document:write") return perms.document === "write";
  if (need === "workspace") return perms.workspace === "read";
  if (need === "network") return !!perms.network?.length;
  return !!perms[need];
}

const permissionKey = (need) => need.split(":")[0];

function parse(text) {
  const options = { ecmaVersion: "latest", locations: true, allowHashBang: true, allowAwaitOutsideFunction: true };
  try {
    return acorn.parse(text, { ...options, sourceType: "module" });
  } catch (moduleError) {
    try {
      return acorn.parse(text, { ...options, sourceType: "script" });
    } catch {
      throw moduleError;
    }
  }
}

/** Shannon entropy in bits per character. */
function entropy(text) {
  const counts = new Map();
  for (const ch of text) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let bits = 0;
  for (const n of counts.values()) bits -= (n / text.length) * Math.log2(n / text.length);
  return bits;
}

/** The literal string a node always evaluates to, or null. */
function literalString(node) {
  if (!node) return null;
  if (node.type === "Literal" && typeof node.value === "string") return node.value;
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) return node.quasis[0].value.cooked;
  return null;
}

/**
 * `new URL("x.js", import.meta.url).href` / `…document.baseURI…`: a fixed
 * file, written so for a sandboxed page. `base` says what it is relative to.
 */
function urlReference(node) {
  const target = node?.type === "MemberExpression" && !node.computed && node.property.name === "href" ? node.object : node;
  if (target?.type !== "NewExpression" || target.callee.type !== "Identifier" || target.callee.name !== "URL") return null;
  const spec = literalString(target.arguments[0]);
  const base = target.arguments[1];
  if (spec === null || !base) return null;
  const isMeta = base.type === "MemberExpression" && base.object.type === "MetaProperty";
  const isDocument = base.type === "MemberExpression" && base.object.type === "Identifier" && base.object.name === "document";
  return isMeta || isDocument ? { spec, base: isMeta ? "module" : "document" } : null;
}

/** The constant start of a string (a URL's origin in `https://x/${path}`). */
function literalPrefix(node) {
  const whole = literalString(node);
  if (whole !== null) return whole;
  if (node?.type === "TemplateLiteral") return node.quasis[0].value.cooked;
  if (node?.type === "BinaryExpression" && node.operator === "+") return literalPrefix(node.left);
  return null;
}

/**
 * Analyse one JavaScript source: imports, rule hits, SDK paths used.
 * `aliases` names that stand for `typora` (and what they were destructured to).
 */
export function analyzeSource(text) {
  const ast = parse(text);
  const imports = [];
  const hits = [];
  const api = [];
  const fetches = [];
  const spawns = [];
  const assets = [];
  const aliases = new Map([["typora", "typora"]]);
  const hit = (rule, level, message, node) => hits.push({ rule, level, message, line: node.loc.start.line });

  const pathOf = (node) => {
    if (!node) return null;
    if (node.type === "Identifier") return aliases.get(node.name) ?? null;
    if (node.type === "ChainExpression") return pathOf(node.expression);
    if (node.type !== "MemberExpression") return null;
    if (node.object.type === "Identifier" && GLOBAL_OBJECTS.has(node.object.name)) {
      const key = node.computed ? literalString(node.property) : node.property.name;
      return key === "typora" ? "typora" : null;
    }
    const base = pathOf(node.object);
    if (!base) return null;
    const key = node.computed ? literalString(node.property) : node.property.name;
    return key === null ? null : `${base}.${key}`;
  };

  // Aliases first (`const view = typora.view`, `const { net } = typora`), in
  // source order, which is what top-level setup code does.
  walk.full(ast, (node) => {
    if (node.type !== "VariableDeclarator" || !node.init) return;
    const base = pathOf(node.init);
    if (!base) return;
    if (node.id.type === "Identifier") aliases.set(node.id.name, base);
    else if (node.id.type === "ObjectPattern")
      for (const prop of node.id.properties)
        if (prop.type === "Property" && !prop.computed && prop.value.type === "Identifier")
          aliases.set(prop.value.name, `${base}.${prop.key.name ?? prop.key.value}`);
  });

  let obfuscatedNames = 0;
  walk.full(ast, (node) => {
    switch (node.type) {
      case "ImportDeclaration":
      case "ExportAllDeclaration":
      case "ExportNamedDeclaration":
        if (node.source) imports.push({ spec: node.source.value, line: node.loc.start.line });
        break;
      case "ImportExpression": {
        const spec = literalString(node.source);
        const url = urlReference(node.source);
        if (spec !== null) imports.push({ spec, line: node.loc.start.line, dynamic: true });
        // A URL resolves "x.js" like "./x.js".
        else if (url)
          imports.push({ spec: /^([a-z][a-z0-9+.-]*:|\.{0,2}\/)/i.test(url.spec) ? url.spec : `./${url.spec}`, line: node.loc.start.line, dynamic: true, base: url.base });
        else hit("code/dynamic-import", "review", "import() of a computed name: check what it can load.", node);
        break;
      }
      case "CallExpression": {
        const callee = node.callee;
        const name = callee.type === "Identifier" ? callee.name : null;
        const member = callee.type === "MemberExpression" && !callee.computed ? callee.property.name : null;
        const onGlobal = callee.type === "MemberExpression" && callee.object.type === "Identifier" && GLOBAL_OBJECTS.has(callee.object.name);
        const indirect =
          callee.type === "SequenceExpression" && callee.expressions.at(-1)?.type === "Identifier" && callee.expressions.at(-1).name === "eval";
        if (name === "eval" || (onGlobal && member === "eval") || indirect)
          hit("code/eval", "error", "eval() runs a string as code.", node);
        if (name === "Function" || (onGlobal && member === "Function"))
          hit("code/function-constructor", "error", "Function() turns a string into code.", node);
        if ((name === "setTimeout" || name === "setInterval") && node.arguments[0] && literalPrefix(node.arguments[0]) !== null)
          hit("code/string-timer", "error", `${name} with a string runs it as code.`, node);
        if (name === "importScripts") hit("code/remote-import", "error", "importScripts() is not available; bundle the code.", node);
        // Literal codes hide a string; converting bytes (`...chunk`) is ordinary.
        if (callee.type === "MemberExpression" && callee.object.type === "Identifier" && callee.object.name === "String" && member === "fromCharCode" &&
          node.arguments.length > 8 && node.arguments.every((a) => a.type === "Literal" && typeof a.value === "number"))
          hit("code/charcode", "review", "Builds a string from character codes: check it is not hiding code or an address.", node);
        const path = pathOf(callee);
        if (path === "typora.runtime.readAsset" && literalString(node.arguments[0]) !== null)
          assets.push({ spec: literalString(node.arguments[0]), line: node.loc.start.line });
        if (name === "fetch" || path === "typora.net.fetch" || path === "typora.view.fetch")
          fetches.push({ via: path ?? "fetch", url: literalPrefix(node.arguments[0]), line: node.loc.start.line });
        if (path === "typora.process.spawn" || path === "typora.view.process.spawn") {
          const arg = node.arguments[0];
          const command = literalString(arg);
          const shell = pathOf(arg)?.endsWith("process.shell") || command === "$shell";
          const binary = arg?.type === "ObjectExpression";
          spawns.push({ command: shell ? "$shell" : command, binary, line: node.loc.start.line });
        }
        break;
      }
      case "NewExpression":
        if (node.callee.type === "Identifier" && node.callee.name === "Function")
          hit("code/function-constructor", "error", "new Function() turns a string into code.", node);
        break;
      case "MemberExpression": {
        const path = pathOf(node);
        if (path?.startsWith("typora.")) api.push({ path, line: node.loc.start.line });
        else if (!path && !node.computed) {
          const method = node.property.name;
          const holder = node.object;
          const ns = holder.type === "Identifier" ? holder.name : holder.type === "MemberExpression" && !holder.computed ? holder.property.name : null;
          const root = holder.type === "MemberExpression" ? holder.object : null;
          if (Object.hasOwn(SHAPES, ns ?? "") && SHAPES[ns].includes(method) && !(root?.type === "Identifier" && NOT_SDK.has(root.name)) && !(holder.type === "Identifier" && NOT_SDK.has(ns)))
            api.push({ path: `typora.${ns}.${method}`, line: node.loc.start.line, shape: true });
        }
        if (node.computed && node.object.type === "Identifier" && GLOBAL_OBJECTS.has(node.object.name) && literalString(node.property) === null)
          hit("code/global-reflection", "review", `${node.object.name}[…] with a computed name can reach any global (eval, Function).`, node);
        break;
      }
      case "Literal":
        if (typeof node.value === "string" && node.value.length > ENCODED_LITERAL && entropy(node.value) > 4.5)
          hit("code/encoded-blob", "review", `A ${(node.value.length / 1024).toFixed(1)} KB encoded string: check what it decodes to.`, node);
        break;
      case "Identifier":
        if (/^_0x[0-9a-f]{3,}$/i.test(node.name)) obfuscatedNames++;
        break;
    }
  });
  if (obfuscatedNames > OBFUSCATED_NAMES)
    hits.push({ rule: "code/obfuscated", level: "error", message: `${obfuscatedNames} _0x… names: obfuscated sources are not accepted.`, line: 1 });

  // Destructured SDK functions (`const { fetch } = typora.net`) count as used.
  for (const [name, path] of aliases) if (name !== "typora" && path.startsWith("typora.")) api.push({ path, line: null });
  return { imports, hits, api, fetches, spawns, assets };
}

// ── HTML and CSS ──────────────────────────────────────────────────────

const REMOTE = /^(?:[a-z][a-z0-9+.-]*:)?\/\//i;
const attr = (tag, name) => new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag)?.slice(1).find((v) => v !== undefined) ?? null;
const lineAt = (text, index) => text.slice(0, index).split("\n").length;
/** Script types the browser runs; data blocks (application/json, …) are not code. */
const RUNS = (type) => !type || /^(module|text\/javascript|application\/javascript|importmap)$/i.test(type.trim());

export function analyzeHtml(text) {
  const refs = [];
  const hits = [];
  for (const m of text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    const tag = `<script ${m[1]}>`;
    const src = attr(tag, "src");
    const type = attr(tag, "type");
    if (src !== null) refs.push({ ref: src, line: lineAt(text, m.index), kind: "script", module: /^module$/i.test(type ?? "") });
    else if (RUNS(type) && m[2].trim())
      hits.push({ rule: "html/inline-script", level: "error", line: lineAt(text, m.index), message: "An inline <script> does not run: the page CSP allows only the extension's files. Move it to a .js file." });
  }
  for (const m of text.matchAll(/<(link|img|source|audio|video|iframe|embed|object|image|use)\b[^>]*>/gi)) {
    const ref = attr(m[0], "href") ?? attr(m[0], "src") ?? attr(m[0], "data") ?? attr(m[0], "xlink:href");
    if (ref !== null) refs.push({ ref, line: lineAt(text, m.index), kind: m[1].toLowerCase() });
  }
  for (const m of text.matchAll(/<[a-z][^>]*\son[a-z]+\s*=/gi))
    hits.push({ rule: "html/inline-handler", level: "error", line: lineAt(text, m.index), message: "Inline event handlers (onclick=…) do not run under the page CSP; use addEventListener." });
  for (const m of text.matchAll(/\s(?:href|src)\s*=\s*["']?\s*javascript:/gi))
    hits.push({ rule: "html/javascript-url", level: "error", line: lineAt(text, m.index), message: "javascript: URLs do not run under the page CSP." });
  for (const m of text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi))
    for (const css of analyzeCss(m[1])) hits.push({ ...css, line: lineAt(text, m.index) + css.line - 1 });
  return { refs, hits };
}

/** Remote resources and value-reading selectors in a stylesheet. */
export function analyzeCss(text) {
  const hits = [];
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));
  for (const m of clean.matchAll(/@import\s+(?:url\(\s*)?["']?([^"')\s;]+)/gi))
    if (REMOTE.test(m[1]) || /^data:/i.test(m[1]))
      hits.push({ rule: "css/remote", level: "error", line: lineAt(clean, m.index), message: `@import of ${m[1]}: bundle the stylesheet.` });
  for (const m of clean.matchAll(/url\(\s*["']?([^"')]+)/gi))
    if (REMOTE.test(m[1].trim()))
      hits.push({ rule: "css/remote", level: "error", line: lineAt(clean, m.index), message: `url(${m[1].trim()}) loads from the network: bundle it (a remote image can tell a server what is being viewed).` });
  // `input[value^="a"]` style selectors leak what is typed, one request per guess.
  for (const m of clean.matchAll(/\[\s*value\s*[\^$*|~]?=/gi))
    hits.push({ rule: "css/value-selector", level: "error", line: lineAt(clean, m.index), message: "Selectors on [value] can read what is typed into fields." });
  return hits;
}

// ── Package ───────────────────────────────────────────────────────────

/** Entry points by where they run. */
export function entries(manifest, files) {
  const out = [];
  const c = manifest.contributes && typeof manifest.contributes === "object" ? manifest.contributes : {};
  if (typeof manifest.main === "string") out.push({ path: manifest.main, context: "main" });
  if (typeof manifest.background === "string") out.push({ path: manifest.background, context: "background" });
  for (const key of ["fenceRenderers", "detailViews", "fileViewers"])
    for (const item of Array.isArray(c[key]) ? c[key] : []) if (typeof item?.entry === "string") out.push({ path: item.entry, context: "page" });
  for (const p of Array.isArray(c.mathjax?.packages) ? c.mathjax.packages : []) if (typeof p?.path === "string") out.push({ path: p.path, context: "math" });
  for (const f of Array.isArray(c.mathjax?.fonts) ? c.mathjax.fonts : [])
    if (typeof f?.path === "string") out.push({ path: `${f.path.replace(/\/+$/, "")}/svg.js`, context: "math" });
  // Any other page in the package can be navigated to from one of these.
  for (const path of files) if (/\.html?$/i.test(path) && !out.some((e) => e.path === path)) out.push({ path, context: "page" });
  return out.filter((e) => files.includes(e.path));
}

/** Resolve a reference from `from` (a package path); null for host-provided files. */
function resolveRef(from, ref) {
  const clean = ref.split(/[?#]/)[0];
  if (!clean) return { skip: true };
  if (/^(data|blob):/i.test(clean)) return { skip: true };
  if (REMOTE.test(clean)) return { remote: true };
  if (/^[a-z][a-z0-9+.-]*:/i.test(clean)) return { remote: true };
  if (clean.startsWith("/")) return { outside: true };
  const joined = posix.normalize(posix.join(posix.dirname(from), decodeURIComponent(clean)));
  if (joined.startsWith("../") || joined === "..") return { outside: true };
  if (joined === "__typora/view.js") return { skip: true };
  return { path: joined };
}

/**
 * Check one package. `vendored` is vendorStatus(dir).vendored; `added` lists
 * permission keys this pull request adds (scripts/permission-diff.mjs).
 */
export function checkCode({ id, dir, manifest, files, vendored, findings, added = [] }) {
  const fileSet = new Set(files);
  const lowerSet = new Map(files.map((f) => [f.toLowerCase(), f]));
  const perms = normalizePermissions(manifest.permissions);
  const contexts = new Map(); // path → Set(context)
  const sources = new Map(); // path → analysis
  const queue = entries(manifest, files).map((e) => ({ ...e, from: null }));
  const at = (file, line) => ({ file, line: line ?? undefined });

  const reference = (from, ref, line, context, reporter = from) => {
    const r = resolveRef(from, ref);
    from = reporter;
    if (r.skip) return;
    if (r.remote) return findings.error("graph/remote", id, `${ref} is loaded from the network; everything that runs ships in the package.`, at(from, line));
    if (r.outside) return findings.error("graph/outside", id, `${ref} points outside the extension.`, at(from, line));
    if (!fileSet.has(r.path)) {
      const other = lowerSet.get(r.path.toLowerCase());
      if (other) return findings.error("graph/case", id, `${ref} is ${other} on disk: the case differs, which breaks on Linux and Windows builds of the package.`, at(from, line));
      return findings.error("graph/missing", id, `${ref} is not in the package (dotfiles and store images are not packaged).`, at(from, line));
    }
    queue.push({ path: r.path, context, from });
  };

  while (queue.length) {
    const { path, context, from: loadedBy } = queue.shift();
    const seen = contexts.get(path);
    if (seen?.has(context)) continue;
    contexts.set(path, new Set([...(seen ?? []), context]));
    if (/\.html?$/i.test(path)) {
      const text = readFileSync(join(dir, path), "utf8");
      const { refs, hits } = analyzeHtml(text);
      for (const h of hits) findings.add(h.level, h.rule, id, h.message, at(path, h.line));
      for (const r of refs) reference(path, r.ref, r.line, r.kind === "script" ? "page" : "asset");
      continue;
    }
    if (/\.css$/i.test(path)) {
      if (!vendored.has(path)) for (const h of analyzeCss(readFileSync(join(dir, path), "utf8"))) findings.add(h.level, h.rule, id, h.message, at(path, h.line));
      continue;
    }
    if (!/\.(m?js|cjs)$/i.test(path) || context === "asset") continue;
    if (!sources.has(path)) {
      try {
        sources.set(path, analyzeSource(readFileSync(join(dir, path), "utf8")));
      } catch (error) {
        findings.error("code/parse", id, `Cannot parse: ${error.message}`, at(path, error.loc?.line));
        sources.set(path, null);
      }
    }
    const analysis = sources.get(path);
    if (!analysis) continue;
    for (const imp of analysis.imports) {
      if (!/^\.{0,2}\//.test(imp.spec) && !REMOTE.test(imp.spec)) {
        findings.error("graph/bare", id, `import "${imp.spec}" names a package; bundle it into the extension and import it by path.`, at(path, imp.line));
        continue;
      }
      // Relative to the page that loaded the script, for document.baseURI.
      const base = imp.base === "document" && loadedBy && /\.html?$/i.test(loadedBy) ? loadedBy : path;
      reference(base, imp.spec, imp.line, context, path);
    }
    // Files read with runtime.readAsset ship as data (iPic's JXA script runs
    // through osascript): they count as used and keep the source rules.
    for (const asset of analysis.assets) reference(path, asset.spec.replace(/^\/?/, ""), asset.line, "asset");
  }

  // Every shipped script, reachable or not, gets the source rules.
  for (const path of files.filter((f) => /\.(m?js|cjs)$/i.test(f))) {
    if (vendored.has(path)) continue;
    const text = readFileSync(join(dir, path), "utf8");
    const longest = text.split("\n").reduce((n, l) => Math.max(n, l.length), 0);
    if (longest > MINIFIED_LINE)
      findings.error("code/minified", id, `A ${longest}-character line: commit readable sources, or register a third-party file in .typora/vendor.json.`, at(path));
    if (!contexts.has(path)) {
      findings.warn("graph/unused", id, "Nothing loads this script; leave it out of the package.", at(path));
      try {
        if (!sources.has(path)) sources.set(path, analyzeSource(text));
      } catch {
        sources.set(path, null);
      }
    }
    const analysis = sources.get(path);
    if (!analysis) continue;
    for (const h of analysis.hits) findings.add(h.level, h.rule, id, h.message, at(path, h.line));
    for (const imp of analysis.imports)
      if (REMOTE.test(imp.spec)) findings.error("code/remote-import", id, `import of ${imp.spec}: everything that runs ships in the package.`, at(path, imp.line));
  }

  // SDK calls against permissions and where they run.
  const used = new Map(); // need → [{path, line}]
  for (const [path, analysis] of sources) {
    if (!analysis || vendored.has(path)) continue;
    const where = [...(contexts.get(path) ?? [])];
    for (const call of analysis.api) {
      for (const rule of API_PERMISSIONS) {
        if (call.path !== rule.prefix && !call.path.startsWith(`${rule.prefix}.`)) continue;
        // `typora.view.process` is a page API; `typora.process` alone is not it.
        if (rule.prefix === "typora.process" && call.path.startsWith("typora.view.")) continue;
        // A page's copy (toolbar `clipboard`, view SDK `ui.copy`) needs no permission.
        if (call.shape && rule.needs === "clipboard" && where.every((c) => c === "page")) continue;
        if (!used.has(rule.needs)) used.set(rule.needs, []);
        used.get(rule.needs).push({ path, line: call.line });
        // A call matched by shape may be another object's method of that name.
        if (!granted(perms, rule.needs) && call.shape)
          findings.warn("api/undeclared", id, `${call.path.replace(/^typora\./, "…")} looks like an SDK call that needs the ${rule.needs.replace(":", ": ")} permission, which the manifest does not declare.`, at(path, call.line));
        else if (!granted(perms, rule.needs))
          findings.error("api/undeclared", id, `${call.path} needs the ${rule.needs.replace(":", ": ")} permission, which the manifest does not declare; Typora refuses the call.`, at(path, call.line));
        const wrong = rule.only ? where.filter((c) => c !== "asset" && !rule.only.includes(c)) : [];
        if (wrong.length)
          findings.error("api/context", id, `${call.path} is not available in ${wrong.join(", ")} (only ${rule.only.join(", ")}).`, at(path, call.line));
      }
    }
    for (const f of analysis.fetches) {
      const inPage = where.includes("page");
      if (f.via === "fetch" && inPage)
        findings.error("api/page-fetch", id, "fetch() in a page is blocked by its CSP (connect-src 'none'); use typora.view.fetch.", at(path, f.line));
      if (f.via === "fetch" && !inPage) {
        if (!used.has("network")) used.set("network", []);
        used.get("network").push({ path, line: f.line });
        if (!granted(perms, "network"))
          findings.error("api/undeclared", id, "fetch() goes through typora.net.fetch and needs the network permission.", at(path, f.line));
      }
      const origin = (() => {
        try {
          return f.url && /^https?:\/\//i.test(f.url) ? new URL(f.url).origin : null;
        } catch {
          return null;
        }
      })();
      if (origin && granted(perms, "network") && !originAllowed(perms.network, origin))
        findings.warn("api/origin", id, `${origin} is not in permissions.network; Typora refuses the request.`, at(path, f.line));
    }
    for (const s of analysis.spawns) {
      const list = Array.isArray(perms.process) ? perms.process : null;
      if (s.binary) continue;
      if (s.command === "$shell") {
        if (list) findings.error("api/process", id, "Starting the login shell needs process: \"*\".", at(path, s.line));
        else findings.review("api/process-shell", id, "Starts the user's login shell.", at(path, s.line));
      } else if (s.command === null) findings.review("api/process-dynamic", id, "Starts a program whose name is computed: check where it comes from.", at(path, s.line));
      else {
        const name = s.command.split(/[\\/]/).pop().replace(/\.(exe|cmd)$/i, "").toLowerCase();
        if (list && !list.some((c) => c.toLowerCase() === name))
          findings.error("api/process", id, `Starts ${s.command}, which is not in permissions.process (${list.join(", ")}).`, at(path, s.line));
        else findings.info("api/process-call", id, `Starts ${s.command}.`, at(path, s.line));
      }
    }
  }
  if (perms.process === "*") findings.review("api/process-any", id, "process: \"*\" runs any program; the pull request has to say why a list of commands is not enough.");

  // Permissions nobody uses.
  const asked = Object.keys(perms);
  for (const key of asked) {
    const needs = API_PERMISSIONS.map((r) => r.needs).filter((n) => permissionKey(n) === key);
    let isUsed = [...used.keys()].some((n) => permissionKey(n) === key);
    // Kroki renderers and publish adapters reach the network through Typora.
    if (key === "network" && (manifest.contributes?.fenceRenderers ?? []).some((r) => r?.kroki)) isUsed = true;
    if (!isUsed && needs.length) {
      const message = `permissions.${key} is declared but no code uses it; ask only for what the extension uses.`;
      if (added.includes(key)) findings.review("api/unused-permission", id, message);
      else findings.warn("api/unused-permission", id, message);
    }
  }
  if (perms.document === "write" && used.has("document:read") && !used.has("document:write"))
    findings.warn("api/unused-permission", id, "document: write is declared but only reads are made; read is enough.");

  // Where each sensitive permission is used, for the reviewer.
  for (const [need, calls] of used)
    for (const call of calls.filter((c) => c.line))
      findings.info("api/call-site", id, `uses ${need}`, at(call.path, call.line));

  return { contexts, used };
}

/** Whether `origin` is allowed by the network list (exact, *.wildcards; {config.*} unknowable). */
export function originAllowed(list = [], origin) {
  const url = new URL(origin);
  return list.some((entry) => {
    if (/^\{config\./.test(entry)) return true;
    try {
      const allowed = new URL(entry.replace("*.", "wildcard."));
      if (allowed.protocol !== url.protocol) return false;
      if (allowed.port !== url.port) return false;
      if (entry.includes("*.")) return url.hostname.endsWith(allowed.hostname.slice("wildcard".length));
      return allowed.hostname === url.hostname;
    } catch {
      return false;
    }
  });
}
