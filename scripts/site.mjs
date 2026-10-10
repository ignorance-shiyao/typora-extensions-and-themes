// HTML for extensions.typora.io. Plain strings; everything user-supplied goes
// through esc().

import { DOCS_URL, REPO_URL } from "./lib.mjs";

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
};

export function permissionKeys(p) {
  const out = [];
  if (p.network?.length) out.push("network");
  if (p.document) out.push(`document:${p.document}`);
  if (p.workspace) out.push("workspace");
  if (p.clipboard) out.push("clipboard");
  return out;
}

const origin = (o) =>
  o.includes("*.") ? `any subdomain of <code>${esc(o.replace("*.", ""))}</code>` : `<code>${esc(o)}</code>`;

export function permissionSentences(p) {
  const out = [];
  if (p.network?.length)
    out.push(`Send and receive data from ${p.network.map(origin).join(", ")}.`);
  if (p.document === "read") out.push("Read the open document.");
  if (p.document === "write") out.push("Read and edit the open document.");
  if (p.workspace === "read") out.push("List and read files in the open folder.");
  if (p.clipboard) out.push("Read and write clipboard text.");
  return out;
}

function layout({ title, description, canonical, assets, body, origin: siteOrigin }) {
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
<meta name="color-scheme" content="light dark">
<link rel="icon" href="${assets.favicon}" type="image/png">
<link rel="stylesheet" href="${assets.css}">
</head>
<body>
<header class="nav">
  <div class="nav-inner">
    <a class="brand" href="/"><img class="mark" src="${assets.icon}" width="28" height="28" alt=""><span>Typora <b>Extensions</b></span></a>
    <nav>
      <a href="${DOCS_URL}">Docs</a>
      <a href="${REPO_URL}">GitHub</a>
    </nav>
  </div>
</header>
<main class="page">
${body}
</main>
<footer class="footer">
  <p>Every extension here is open source, reviewed, and built from <a href="${REPO_URL}">typora/typora-extensions</a> by Typora's CI. Extensions run sandboxed with the permissions shown on their page.</p>
  <p><a href="${DOCS_URL}">Developer docs</a> · <a href="${siteOrigin}/index.json">index.json</a> · <a href="${REPO_URL}/blob/main/CONTRIBUTING.md">Submit an extension</a></p>
</footer>
${assets.js ? `<script src="${assets.js}" defer></script>` : ""}
</body>
</html>
`;
}

function tierBadge(tier) {
  const t = TIERS[tier];
  return `<span class="badge tier tier-${tier.toLowerCase()}" title="${esc(t.explain)}">${esc(t.label)}</span>`;
}

function permissionBadges(p) {
  const keys = permissionKeys(p);
  if (!keys.length) return `<span class="badge perm perm-none">No permissions</span>`;
  return keys.map((k) => `<span class="badge perm">${esc(PERMISSION_BADGES[k])}</span>`).join("");
}

export function homePage({ entries, assets, origin: siteOrigin }) {
  const cards = entries
    .map((e) => {
      const search = [e.name, e.description, e.id, e.author, ...e.keywords].join(" ").toLowerCase();
      const perms = permissionKeys(e.permissions);
      return `<a class="card" href="/${esc(e.id)}/" data-search="${esc(search)}" data-tier="${e.tier}" data-perms="${esc(perms.join(" ") || "none")}">
  <div class="card-head"><h2>${esc(e.name)}</h2>${tierBadge(e.tier)}</div>
  <p class="card-desc">${esc(e.description)}</p>
  <div class="card-foot"><span class="mono">${esc(e.id)}</span><span class="dot">·</span><span>v${esc(e.version)}</span></div>
  <div class="badges">${permissionBadges(e.permissions)}</div>
</a>`;
    })
    .join("\n");
  const body = `<section class="hero">
  <h1>Extensions for Typora</h1>
  <p class="lead">Diagrams, views, templates, file viewers and more. Install them in Typora from <strong>Settings ▸ Extensions</strong>.</p>
</section>
<section class="toolbar" aria-label="Search and filter">
  <input id="search" type="search" placeholder="Search extensions" autocomplete="off" spellcheck="false" aria-label="Search extensions">
  <div class="filters" role="group" aria-label="Filter">
    <button type="button" class="chip" data-filter="all" aria-pressed="true">All</button>
    <button type="button" class="chip" data-filter="L0" aria-pressed="false" title="${esc(TIERS.L0.explain)}">Data</button>
    <button type="button" class="chip" data-filter="L1" aria-pressed="false" title="${esc(TIERS.L1.explain)}">Pages</button>
    <button type="button" class="chip" data-filter="L2" aria-pressed="false" title="${esc(TIERS.L2.explain)}">Code</button>
    <button type="button" class="chip" data-filter="none" aria-pressed="false" title="Needs no permissions">No permissions</button>
  </div>
  <p class="count" id="count" aria-live="polite">${entries.length} extension${entries.length === 1 ? "" : "s"}</p>
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
  const inline = (s) =>
    esc(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, url) => link(url, alt || url))
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => link(url, label))
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*\w])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
      .replace(/(^|\W)_([^_\s][^_]*)_(?=\W|$)/g, "$1<em>$2</em>");
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

const formatSize = (bytes) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`);
const formatDate = (iso) =>
  new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });

export function extensionPage({ entry, manifest, files, readme, assets, origin: siteOrigin }) {
  const perms = permissionSentences(entry.permissions);
  const tier = TIERS[entry.tier];
  const body = `<nav class="crumbs"><a href="/">Extensions</a> <span>/</span> ${esc(entry.name)}</nav>
<div class="detail">
  <article class="detail-main">
    <header class="detail-head">
      <h1>${esc(entry.name)}</h1>
      <p class="meta">${entry.author ? `by ${esc(entry.author)} · ` : ""}v${esc(entry.version)} · updated ${esc(formatDate(entry.updatedAt))}</p>
      <p class="lead">${esc(entry.description)}</p>
      <div class="badges">${tierBadge(entry.tier)}${permissionBadges(entry.permissions)}${entry.keywords.map((k) => `<span class="badge kw">${esc(k)}</span>`).join("")}</div>
    </header>

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
      <ol>
        <li>Open Typora ▸ <strong>Settings ▸ Extensions</strong>.</li>
        <li>Search for <strong>${esc(entry.name)}</strong> and click <strong>Install</strong>.</li>
      </ol>
      <a class="button" href="${esc(entry.download.url)}" download>Download .zip <span>${esc(formatSize(entry.download.size))}</span></a>
      <p class="small">Then use <em>Settings ▸ Extensions ▸ Install from File…</em></p>
      <p class="small hash" title="SHA-256 of the .zip">SHA-256 <code>${esc(entry.download.sha256)}</code></p>
    </div>
    <dl class="facts">
      <dt>ID</dt><dd><code>${esc(entry.id)}</code></dd>
      <dt>Version</dt><dd>${esc(entry.version)}</dd>
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
    assets: { ...assets, js: null },
    body,
    origin: siteOrigin,
  });
}

export function notFoundPage({ assets, origin: siteOrigin }) {
  return layout({
    title: "Not found · Typora Extensions",
    description: "This page does not exist.",
    canonical: null,
    assets: { ...assets, js: null },
    body: `<section class="hero notfound"><h1>Not found</h1><p class="lead">There is no extension or page here. It may have been renamed or removed.</p><p><a class="button" href="/">Browse extensions</a></p></section>`,
    origin: siteOrigin,
  });
}
