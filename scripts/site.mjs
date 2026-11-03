// HTML for extensions.typora.io. Plain strings; everything user-supplied goes
// through esc().

import { CONFIG_ORIGIN, DOCS_ORIGIN, DOCS_URL, HOME_ORIGIN, OS_NAMES, REPO_URL, SITE_ORIGIN, TAGS, THEMES_SITE_ORIGIN, platformLabel } from "./lib.mjs";

export const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const TIERS = {
  L0: { label: "Data", long: "Data only", explain: "Typora applies its data (rules, templates, settings). No extension code runs." },
  L1: { label: "Pages", long: "Sandboxed pages", explain: "Ships HTML views that run in a sandboxed frame and only see what Typora sends them." },
  L2: { label: "Code", long: "Sandboxed code", explain: "Runs code in a locked-down worker that can only use the API its permissions allow." },
};

const PERMISSION_BADGES = {
  network: "Network",
  "document:read": "Reads document",
  "document:write": "Edits document",
  workspace: "Reads folder",
  clipboard: "Clipboard",
  ai: "Uses your AI model",
  process: "Runs programs",
};

export function permissionKeys(p) {
  const out = [];
  if (p.network?.length) out.push("network");
  if (p.document) out.push(`document:${p.document}`);
  if (p.workspace) out.push("workspace");
  if (p.clipboard) out.push("clipboard");
  if (p.ai) out.push("ai");
  if (p.process) out.push("process");
  return out;
}

/** `settings`: the manifest's configuration properties, to name a `{config.<key>}` origin. */
export function permissionSentences(p, settings = {}) {
  const origin = (o) => {
    const key = CONFIG_ORIGIN.exec(o)?.[1];
    if (key !== undefined) return `the server you enter in its <em>${esc(settings[key]?.title ?? key)}</em> option`;
    return o.includes("*.") ? `any subdomain of <code>${esc(o.replace("*.", ""))}</code>` : `<code>${esc(o)}</code>`;
  };
  const out = [];
  if (p.network?.length)
    out.push(`Send and receive data from ${p.network.map(origin).join(", ")}.`);
  if (p.document === "read") out.push("Read the open document.");
  if (p.document === "write") out.push("Read and edit the open document.");
  if (p.workspace === "read") out.push("List and read files in the open folder.");
  if (p.clipboard) out.push("Read and write clipboard text.");
  if (p.ai) out.push("Send text to the AI model you set up in Typora's Settings ▸ Intelligence.");
  if (p.process === "*") out.push("Run any program on your computer as you, including your shell. Programs are outside the sandbox.");
  else if (p.process) out.push(`Run ${p.process.length ? p.process.map((c) => `<code>${esc(c)}</code>`).join(", ") : "the programs it comes with"} as you, outside the sandbox.`);
  return out;
}

/** Sets the page's appearance before it paints: the visitor's choice, else the
 *  system's, which it then follows. The header's switch saves a choice in a
 *  cookie for the whole domain, which docs reads too (apps/docs/.vitepress). */
export const APPEARANCE_SCRIPT = `<script>
(() => {
  const root = document.documentElement;
  const system = matchMedia("(prefers-color-scheme: dark)");
  const saved = () => /(?:^|; )typora-appearance=(light|dark)/.exec(document.cookie)?.[1];
  const apply = (mode) => {
    root.dataset.theme = mode;
    root.style.colorScheme = mode;
    document.querySelector(".appearance")?.setAttribute("aria-checked", mode === "dark");
  };
  const fromSystem = () => (system.matches ? "dark" : "light");
  apply(saved() ?? fromSystem());
  system.addEventListener("change", () => saved() ?? apply(fromSystem()));
  document.addEventListener("DOMContentLoaded", () => apply(root.dataset.theme));
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".appearance")) return;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    apply(next);
    const domain = /(?:^|\\.)(typora\\.io|typoraio\\.cn)$/.exec(location.hostname)?.[1];
    document.cookie = \`typora-appearance=\${next}; path=/; max-age=31536000; samesite=lax\${domain ? \`; domain=\${domain}; secure\` : ""}\`;
  });
})();
</script>`;

const DEFAULT_SITES = { docs: DOCS_ORIGIN, extensions: SITE_ORIGIN, themes: THEMES_SITE_ORIGIN, home: HOME_ORIGIN };
const SUN = '<svg class="sun" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';
const MOON = '<svg class="moon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>';

/** The header of docs, extensions and theme2 (docs draws its own in
 *  apps/docs/.vitepress, with VitePress's switch, which this one copies), with
 *  `active` the site it is on. */
export function siteHeader(active, sites = DEFAULT_SITES) {
  const item = (key, label) =>
    `<li${active === key ? ' class="active"' : ""}><a href="${esc(sites[key])}/"${active === key ? ' aria-current="page"' : ' target="_blank" rel="noreferrer"'}>${label}</a></li>`;
  return `<header class="nav">
  <div class="nav-inner">
    <div class="product-brand">
      <a class="product-name" href="/">Typora</a>
      <details class="version-switcher">
        <summary class="v2" aria-label="Typora version"><span>2.0 beta</span><svg class="version-chevron" width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="m2 3.5 3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg></summary>
        <div class="version-options" aria-label="Typora versions">
          <a href="/" aria-current="true">2.0 beta</a>
          ${active === "extensions" ? '<button type="button" data-version-unsupported>1.0</button>' : '<a href="https://theme.typora.io/">1.0</a>'}
        </div>
      </details>
    </div>
    <div class="nav-links">
      <ul>
        ${item("docs", "Docs")}
        ${item("extensions", "Extensions")}
        ${item("themes", "Themes")}
        ${item("home", "Homepage")}
      </ul>
      <button type="button" class="appearance" role="switch" aria-checked="false" aria-label="Dark mode"><span class="check">${SUN}${MOON}</span></button>
    </div>
  </div>
</header>${active === "extensions" ? `
<dialog class="version-dialog" aria-labelledby="version-dialog-title" aria-describedby="version-dialog-description">
  <h2 id="version-dialog-title">Extensions require Typora 2.0</h2>
  <p id="version-dialog-description">Typora 1.0 does not support extensions. Use Typora 2.0 beta to install and use extensions.</p>
  <form method="dialog"><button autofocus>OK</button></form>
</dialog>` : ""}`;
}

function layout({ title, description, canonical, assets, body, origin: siteOrigin, sites, noindex = false }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ""}
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
${noindex ? '<meta name="robots" content="noindex">' : ""}
${APPEARANCE_SCRIPT}
<link rel="icon" href="${assets.favicon}" type="image/png">
<link rel="stylesheet" href="${assets.css}">
</head>
<body>
${siteHeader("extensions", sites)}
<main class="page">
${body}
</main>
<footer class="footer">
  <p>Every extension here is open source, reviewed, and built from <a href="${REPO_URL}">typora/typora-extensions</a> by Typora's CI. Extensions run sandboxed with the permissions shown on their page.</p>
  <p><a href="${DOCS_URL}">Developer docs</a> · <a href="${siteOrigin}/index.json">index.json</a> · <a href="${REPO_URL}/blob/main/CONTRIBUTING.md">Submit an extension</a> · <a href="${REPO_URL}">GitHub</a></p>
</footer>
${assets.js ? `<script src="${assets.js}" defer></script>` : ""}
</body>
</html>
`;
}

function permissionBadges(p) {
  const keys = permissionKeys(p);
  if (!keys.length) return `<span class="badge perm perm-none">No permissions</span>`;
  return keys.map((k) => `<span class="badge perm">${esc(PERMISSION_BADGES[k])}</span>`).join("");
}

/** "macOS only" (etc.) for an extension limited by `os`; nothing when it runs everywhere. */
function platformBadge(os) {
  const label = platformLabel(os);
  return label ? `<span class="badge platform" title="Runs on ${esc(os.map((o) => OS_NAMES[o]).join(", "))}">${esc(label)}</span>` : "";
}

/** `?tag=` value of a tag: "Markdown Extension" → "markdown-extension". */
export const tagSlug = (tag) => tag.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// A picture that fails to load (say, WebP in an old Safari) leaves its gray panel.
const ON_ERROR = `onerror="this.hidden=true"`;

/** Card picture: the cover, else the screenshot cropped, else the name on a plain panel. */
function cardMedia(entry) {
  const src = entry.cover ?? entry.screenshot;
  if (src) return `<div class="card-media"><img src="${esc(src)}" alt="" loading="lazy" decoding="async" ${ON_ERROR}></div>`;
  return `<div class="card-media placeholder" aria-hidden="true"><span>${esc(entry.name)}</span></div>`;
}

export function homePage({ entries, assets, origin: siteOrigin, sites }) {
  entries = entries.filter((e) => e.unlisted !== true);
  const cards = entries
    .map((e) => {
      const search = [e.name, e.description, e.id, e.author, ...e.keywords, ...e.tags, platformLabel(e.os) ?? ""].join(" ").toLowerCase();
      return `<a class="card" href="/${esc(e.id)}/" data-search="${esc(search)}" data-tags="${esc(e.tags.map(tagSlug).join(" "))}">
  ${cardMedia(e)}
  <div class="card-body">
    <div class="card-head"><h2>${esc(e.name)}</h2><span class="version">v${esc(e.version)}</span></div>
    <p class="card-desc">${esc(e.description)}</p>
    <div class="card-foot">${e.author ? `<span class="author">${esc(e.author)}</span>` : ""}<span class="pills">${platformBadge(e.os)}${e.tags.map((t) => `<span class="badge tag">${esc(t)}</span>`).join("")}${permissionBadges(e.permissions)}<span class="badge more" hidden>»</span></span></div>
  </div>
</a>`;
    })
    .join("\n");
  const used = TAGS.filter((t) => t === "Data Sync" || entries.some((e) => e.tags.includes(t)));
  const body = `<section class="hero">
  <h1>Extensions for Typora <span class="v2">2.0</span></h1>
  <p class="lead">Diagrams, views, templates, file viewers and more. Install them in Typora from <strong>Settings ▸ Extensions</strong>.</p>
</section>
<section class="toolbar" aria-label="Search and filter">
  <input id="search" type="search" placeholder="Search extensions" autocomplete="off" spellcheck="false" aria-label="Search extensions">
  <div class="filters" role="group" aria-label="Tags">
    <button type="button" class="chip" data-tag="" aria-pressed="true">All</button>
${used.map((t) => `    <button type="button" class="chip" data-tag="${esc(tagSlug(t))}" aria-pressed="false">${esc(t)}</button>`).join("\n")}
  </div>
</section>
<section class="grid" id="grid">
${cards}
</section>
<p class="empty" id="empty" hidden>No extensions match. <a href="${DOCS_URL}">Build one?</a></p>`;
  return layout({
    title: "Typora Extensions",
    description: "Browse and install extensions for Typora: diagrams, views, templates, file viewers and more.",
    canonical: `${siteOrigin}/`,
    assets,
    body,
    origin: siteOrigin,
    sites,
  });
}

const listNames = (items) => items.map((s) => `<code>${esc(s)}</code>`).join(", ");
const plainNames = (items) => items.map(esc).join(", ");

/** "What it adds", from the manifest and the packaged file list. */
export function contributionSummary(manifest, files) {
  const c = manifest.contributes && typeof manifest.contributes === "object" ? manifest.contributes : {};
  const rows = [];
  const add = (label, html) => rows.push(`<dt>${esc(label)}</dt><dd>${html}</dd>`);
  const commandTitle = (id) => (c.commands ?? []).find((cmd) => cmd.id === id)?.title ?? id;
  const folderNames = (folder) => {
    const prefix = `${String(folder).replace(/\/+$/, "")}/`;
    return files
      .filter((f) => f.startsWith(prefix) && !f.slice(prefix.length).includes("/"))
      .map((f) => f.slice(prefix.length).replace(/\.[^.]+$/, ""));
  };

  if (Array.isArray(c.localizations) && c.localizations.length)
    add("Display language", plainNames(c.localizations.map((l) => (l.englishName ? `${l.name} (${l.englishName})` : l.name))));
  if (Array.isArray(c.dictionaries) && c.dictionaries.length)
    add("Spelling dictionaries", `${plainNames(c.dictionaries.map((d) => d.language))} — used when the system spellchecker lacks the language`);
  if (Array.isArray(c.fenceRenderers) && c.fenceRenderers.length) {
    const fences = (r) => listNames((Array.isArray(r.lang) ? r.lang : [r.lang]).map((l) => "```" + l));
    const kroki = c.fenceRenderers.filter((r) => r.kroki);
    const items = c.fenceRenderers
      .filter((r) => !r.kroki)
      .map((r) => `${fences(r)}${r.mode === "interactive" ? " (interactive)" : ""}`);
    if (kroki.length) items.push(`${kroki.map(fences).join(", ")}, drawn by a Kroki server`);
    add("Code block renderers", items.join("<br>"));
  }
  if (Array.isArray(c.fileViewers) && c.fileViewers.length)
    add("File viewers", c.fileViewers.map((v) => `${esc(v.title ?? v.id)} (${plainNames((v.extensions ?? []).map((x) => `.${x}`))})${v.editable ? ", editable" : ""}`).join("<br>"));
  if (Array.isArray(c.detailViews) && c.detailViews.length) add("Detail views", plainNames(c.detailViews.map((v) => v.title ?? v.id)));
  if (Array.isArray(c.imageUploaders) && c.imageUploaders.length)
    add(
      c.imageUploaders.length === 1 ? "Image uploader" : "Image uploaders",
      `${plainNames(c.imageUploaders.map((u) => u.title ?? u.id))} — pick it in <em>Settings ▸ Image ▸ Image Uploader</em>`,
    );
  if (Array.isArray(c.inlineRules) && c.inlineRules.length)
    add("Inline rules", plainNames(c.inlineRules.map((r) => r.index?.title ?? r.title?.replace(/\$\d/g, "…") ?? r.id)));
  if (Array.isArray(c.commands) && c.commands.length) add("Commands", plainNames(c.commands.map((cmd) => cmd.title ?? cmd.id)));
  if (Array.isArray(c.keyBindings) && c.keyBindings.length)
    add("Key bindings", c.keyBindings.map((k) => `<kbd>${esc(k.key)}</kbd> ${esc(commandTitle(k.command))}`).join("<br>"));
  if (Array.isArray(c.inputRules) && c.inputRules.length) {
    const pairs = c.inputRules.filter((r) => Array.isArray(r.pair)).map((r) => r.pair.join(""));
    const replaces = c.inputRules.filter((r) => r.match !== undefined).map((r) => `${r.match} → ${r.replace}`);
    add("Typing rules", [pairs.length && `Auto-pairs ${listNames(pairs)}`, replaces.length && `Replaces ${listNames(replaces)}`].filter(Boolean).join("<br>"));
  }
  if (c.texMacros && typeof c.texMacros === "object")
    add("TeX macros", listNames(Object.keys(c.texMacros).map((m) => `\\${m.replace(/^\\/, "")}`)));
  if (Array.isArray(c.mathjax?.fonts) && c.mathjax.fonts.length)
    add(
      c.mathjax.fonts.length === 1 ? "Math font" : "Math fonts",
      `${plainNames(c.mathjax.fonts.map((f) => f.name ?? f.id))} — pick it in <em>Settings ▸ Markdown ▸ Math ▸ Math Font</em>`,
    );
  if (Array.isArray(c.mathjax?.packages) && c.mathjax.packages.length)
    add("TeX packages", listNames(c.mathjax.packages.map((p) => p.id)));
  if (c.templates) add("Templates", plainNames(folderNames(c.templates)) || "A templates folder");
  if (c.snippets) add("Snippets", plainNames(folderNames(c.snippets)) || "A snippets folder");
  if (Array.isArray(c.customFormats) && c.customFormats.length) add("Custom formats", plainNames(c.customFormats.map((f) => f.name)));
  if (Array.isArray(c.themes) && c.themes.length) add("Themes", plainNames(c.themes.map((t) => (typeof t === "string" ? t : t.name ?? t.path))));
  if (Array.isArray(c.grammars) && c.grammars.length) add("Grammars", plainNames(c.grammars.map((g) => g.language ?? g.scopeName ?? g.path ?? "grammar")));
  if (c.menus && typeof c.menus === "object") {
    const n = Object.values(c.menus).reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0);
    if (n) add("Menu items", String(n));
  }
  if (c.configuration?.properties) {
    const props = Object.entries(c.configuration.properties).map(([key, p]) => p.title ?? key);
    add("Settings", plainNames(props));
  }
  if (manifest.main) add("Window code", "Runs in a sandboxed worker in each window.");
  if (manifest.background) add("Background code", "Runs once per app in a sandboxed worker.");
  return rows.length ? `<dl class="summary">${rows.join("")}</dl>` : "<p>Nothing declared.</p>";
}

/** Very small Markdown → HTML for extension READMEs (escaped; no raw HTML). */
export function renderMarkdown(text, baseUrl) {
  // Code spans first (any backtick run, so `` ` ```js ` `` works), kept out of
  // the emphasis and link rules below.
  const inline = (s) => {
    const codes = [];
    const text = s.replace(/(?<!`)(`+)(?!`)(.+?)(?<!`)\1(?!`)/g, (_, ticks, code) => {
      codes.push(`<code>${esc(/^ .* $/.test(code) ? code.slice(1, -1) : code)}</code>`);
      return `\0${codes.length - 1}\0`;
    });
    return emphasis(esc(text)).replace(/\0(\d+)\0/g, (_, n) => codes[n]);
  };
  const emphasis = (s) =>
    s
      .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, url) => link(url, alt || url))
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => link(url, label))
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*\w])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
      .replace(/(^|\W)_([^_\s][^_]*)_(?=\W|$)/g, "$1<em>$2</em>");
  // GFM table cells: split on | outside code spans; \| is a literal bar.
  const cells = (row) => {
    const out = [""];
    for (let i = 0, ticks = 0; i < row.length; i++) {
      const c = row[i];
      if (c === "\\" && row[i + 1] === "|") out[out.length - 1] += row[++i];
      else if (c === "`") {
        let n = 1;
        while (row[i + n] === "`") n++;
        ticks = ticks === n ? 0 : ticks || n;
        out[out.length - 1] += row.slice(i, i + n);
        i += n - 1;
      } else if (c === "|" && !ticks) out.push("");
      else out[out.length - 1] += c;
    }
    if (/^\s*\|/.test(row)) out.shift();
    if (/\|\s*$/.test(row) && !/\\\|\s*$/.test(row)) out.pop();
    return out.map((cell) => cell.trim());
  };
  const isDelimiterRow = (line) => /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(line) && line.includes("-");
  const link = (url, label) => {
    const href = url.replace(/&amp;/g, "&");
    if (/^https?:\/\//i.test(href)) return `<a href="${esc(href)}" rel="nofollow">${label}</a>`;
    if (/^[a-z]+:/i.test(href) || href.startsWith("/")) return label;
    return `<a href="${esc(`${baseUrl}/${href.replace(/^\.\//, "")}`)}" rel="nofollow">${label}</a>`;
  };
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let para = [];
  let list = null;
  const flush = () => {
    if (para.length) out.push(`<p>${inline(para.join(" "))}</p>`);
    para = [];
    if (list) out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join("")}</${list.tag}>`);
    list = null;
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m;
    if ((m = /^(```|~~~)/.exec(line))) {
      flush();
      const body = [];
      while (++i < lines.length && !lines[i].startsWith(m[1])) body.push(lines[i]);
      out.push(`<pre><code>${esc(body.join("\n"))}</code></pre>`);
    } else if (line.includes("|") && i + 1 < lines.length && isDelimiterRow(lines[i + 1])) {
      flush();
      const align = cells(lines[++i]).map((c) => (c.endsWith(":") ? (c.startsWith(":") ? "center" : "right") : c.startsWith(":") ? "left" : ""));
      const row = (cols, tag) =>
        `<tr>${align.map((a, n) => `<${tag}${a ? ` style="text-align:${a}"` : ""}>${inline(cols[n] ?? "")}</${tag}>`).join("")}</tr>`;
      const body = [];
      while (i + 1 < lines.length && lines[i + 1].includes("|") && !/^\s*$/.test(lines[i + 1])) body.push(row(cells(lines[++i]), "td"));
      out.push(`<div class="table"><table><thead>${row(cells(line), "th")}</thead><tbody>${body.join("")}</tbody></table></div>`);
    } else if ((m = /^(#{1,6})\s+(.*?)\s*#*$/.exec(line))) {
      flush();
      const level = Math.min(6, m[1].length + 1); // the page owns <h1>
      out.push(`<h${level}>${inline(m[2])}</h${level}>`);
    } else if ((m = /^\s*([-*+]|\d+[.)])\s+(.*)$/.exec(line))) {
      if (para.length) flush();
      const tag = /\d/.test(m[1]) ? "ol" : "ul";
      if (list && list.tag !== tag) flush();
      list ??= { tag, items: [] };
      list.items.push(m[2]);
    } else if ((m = /^>\s?(.*)$/.exec(line))) {
      flush();
      out.push(`<blockquote><p>${inline(m[1])}</p></blockquote>`);
    } else if (/^\s*$/.test(line)) {
      flush();
    } else if (/^(-{3,}|\*{3,})\s*$/.test(line)) {
      flush();
      out.push("<hr>");
    } else if (list && /^\s+\S/.test(line)) {
      list.items[list.items.length - 1] += ` ${line.trim()}`;
    } else {
      if (list) flush();
      para.push(line.trim());
    }
  }
  flush();
  return out.join("\n");
}

export const formatSize = (bytes) =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const formatDate = (iso) =>
  new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });

export function extensionPage({ entry, manifest, files, readme, assets, origin: siteOrigin, sites }) {
  const perms = permissionSentences(entry.permissions, manifest.contributes?.configuration?.properties);
  const tier = TIERS[entry.tier];
  const body = `<nav class="crumbs"><a href="/">Extensions</a> <span>/</span> ${esc(entry.name)}</nav>
<div class="detail">
  <article class="detail-main">
    <header class="detail-head">
      <h1>${esc(entry.name)}</h1>
      <p class="meta">${entry.author ? `by ${esc(entry.author)} · ` : ""}v${esc(entry.version)} · updated ${esc(formatDate(entry.updatedAt))}</p>
      <p class="lead">${esc(entry.description)}</p>
      <div class="badges">${platformBadge(entry.os)}${entry.tags.map((t) => `<a class="badge tag" href="/?tag=${esc(tagSlug(t))}">${esc(t)}</a>`).join("")}${permissionBadges(entry.permissions)}${entry.keywords.map((k) => `<span class="badge kw">${esc(k)}</span>`).join("")}</div>
    </header>

    ${entry.screenshot ? `<div class="detail-media"><img src="${esc(entry.screenshot)}" alt="${esc(`${entry.name} in Typora`)}" ${ON_ERROR}></div>` : ""}

    <section>
      <h2>Permissions</h2>
      ${
        perms.length
          ? `<p>When you install it, Typora asks you to allow it to:</p><ul class="perms">${perms.map((p) => `<li>${p}</li>`).join("")}</ul>`
          : `<p class="muted-box">No permissions. It cannot use the network, the clipboard or your files, and only sees what Typora hands it.</p>`
      }
      <p class="tier-note"><strong>${esc(tier.long)}.</strong> ${esc(tier.explain)}</p>
    </section>

    <section>
      <h2>What it adds</h2>
      ${contributionSummary(manifest, files)}
    </section>

    ${readme ? `<section class="readme"><h2>Readme</h2>${readme}</section>` : ""}
  </article>

  <aside class="detail-side">
    <div class="install">
      <h2>Install</h2>
      <div class="split">
        <a class="button" href="typora://extension/${esc(entry.id)}">Install</a>
        <details class="split-menu">
          <summary class="button" aria-label="More ways to install"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></summary>
          <div class="menu">
            <a href="${esc(entry.download.url)}" download><span class="menu-label">Download</span><span class="menu-size">${esc(formatSize(entry.download.size))}</span>
              <span class="menu-note">Open the file with Typora, or use Settings ▸ Extensions ▸ Install from File…</span></a>
          </div>
        </details>
      </div>
      ${platformLabel(entry.os) ? `<p class="small platform-note">Requires ${esc(entry.os.map((o) => OS_NAMES[o]).join(" or "))}. Typora on other platforms lists it as unavailable.</p>` : ""}
      <p class="small">Opens Typora, which asks before installing.${manifest.unlisted === true ? "" : ` Or in Typora, open <em>Settings ▸ Extensions</em> and search for <strong>${esc(entry.name)}</strong>.`}</p>
      <p class="small hash" title="SHA-256 of the .typora-extension file">SHA-256 <code>${esc(entry.download.sha256)}</code></p>
    </div>
    <dl class="facts">
      ${entry.author ? `<dt>Author</dt><dd>${esc(entry.author)}</dd>` : ""}
      <dt>ID</dt><dd><code>${esc(entry.id)}</code></dd>
      <dt>Version</dt><dd>${esc(entry.version)}</dd>
      <dt>Platforms</dt><dd>${esc(platformLabel(entry.os) ? entry.os.map((o) => OS_NAMES[o]).join(", ") : "macOS, Windows, Linux")}</dd>
      ${entry.engines.typora ? `<dt>Requires</dt><dd>Typora ${esc(entry.engines.typora)}</dd>` : ""}
      <dt>Source</dt><dd><a href="${esc(entry.repository)}">GitHub</a></dd>
      <dt>Problems?</dt><dd><a href="${esc(`${REPO_URL}/issues/new?title=${encodeURIComponent(`${entry.id}: `)}`)}">Report an issue</a></dd>
    </dl>
  </aside>
</div>`;
  return layout({
    title: `${entry.name} · Typora Extensions`,
    description: entry.description || `${entry.name}, an extension for Typora.`,
    canonical: entry.page,
    noindex: manifest.unlisted === true,
    assets,
    body,
    origin: siteOrigin,
    sites,
  });
}

export function notFoundPage({ assets, origin: siteOrigin, sites }) {
  return layout({
    title: "Not found · Typora Extensions",
    description: "This page does not exist.",
    canonical: null,
    assets: { ...assets, js: null },
    body: `<section class="hero notfound"><h1>Not found</h1><p class="lead">There is no extension or page here. It may have been renamed or removed.</p><p><a class="button" href="/">Browse extensions</a></p></section>`,
    origin: siteOrigin,
    sites,
  });
}
