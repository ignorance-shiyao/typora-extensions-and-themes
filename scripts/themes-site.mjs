// HTML for themes.typora.io, modelled on theme.typora.io. Plain strings;
// everything user-supplied goes through esc().

import { DOCS_URL, REPO_URL } from "./lib.mjs";
import { APPEARANCE_SCRIPT, esc, formatSize, siteHeader } from "./site.mjs";

const WRITE_URL = `${DOCS_URL}themes`;
const GUIDE_URL = DOCS_URL.replace("/extensions/", "/guide/themes");
const V1_GALLERY = "/v1/";

const SCHEMES = { auto: "Light & dark", light: "Light", dark: "Dark" };
const schemeLabel = (theme) => theme.colorSchemes.map((scheme) => SCHEMES[scheme]).join(", ");

function layout({ title, description, canonical, assets, body, plain = false, origin: siteOrigin, noindex = false, sites }) {
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
<body${plain ? ' class="plain"' : ""}>
${siteHeader("themes", sites)}
${body}
<footer class="footer">
  <p>How to <a href="/doc/#install">install</a> / <a href="/doc/#write">write</a> / <a href="/doc/#submit">submit</a> a theme</p>
  <p class="small"><a href="${REPO_URL}">GitHub</a> · <a href="${esc(siteOrigin)}/sitemap.xml">Sitemap</a></p>
</footer>
<script src="${assets.js}" defer></script>
</body>
</html>
`;
}

/** Tile picture, or the name on a blank panel while a theme has no cover. */
function tile(theme) {
  const src = theme.cover ?? theme.screenshot;
  if (src) return `<img src="${esc(src)}" alt="" loading="lazy" decoding="async" onerror="this.hidden=true">`;
  return `<span class="tile-name">${esc(theme.name)}</span>`;
}

export function galleryPage({ themes, assets, origin: siteOrigin, sites }) {
  const items = themes
    .map(
      (theme) => `<a class="item" href="/${esc(theme.slug)}/">
  <div class="item-image">${tile(theme)}</div>
  <div class="item-label"><span class="item-name">${esc(theme.name)}</span><span class="item-scheme">${esc(schemeLabel(theme))}</span></div>
</a>`,
    )
    .join("\n");
  return layout({
    title: "Themes Gallery — Typora",
    description: "Themes for Typora 2.0: pick one and install it, or write and share your own.",
    canonical: `${siteOrigin}/`,
    assets,
    sites,
    origin: siteOrigin,
    body: `<main id="content">
<div class="gallery">
${items}
</div>
</main>`,
  });
}

const formatDate = (iso) => iso.slice(0, 10).replaceAll("-", "/");

function themeActions(theme) {
  if (theme.builtIn)
    return `<a class="btn disabled" aria-disabled="true"><span class="hide-on-hover">Built-in with Typora</span><span class="show-on-hover">No Need to Download</span></a>`;
  const file = theme.download.url.split("/").pop();
  return `<div class="split">
        <a class="split-button" href="typora://extension/${esc(theme.id)}">Install</a>
        <details class="split-menu">
          <summary class="split-button" aria-label="More ways to install"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></summary>
          <div class="menu">
            <a href="/download/${esc(file)}" download><span class="menu-label">Download</span><span class="menu-size">${esc(formatSize(theme.download.size))}</span>
              <span class="menu-note">Open the file with Typora, or use Settings ▸ View ▸ Install from Local File…</span></a>
            <a href="${esc(theme.repository)}"><span class="menu-label">Homepage</span></a>
          </div>
        </details>
      </div>`;
}

export function themePage({ theme, assets, origin: siteOrigin, sites }) {
  return layout({
    title: `${theme.name} — Typora Themes`,
    description: theme.description || `${theme.name}, a theme for Typora.`,
    canonical: theme.page,
    assets,
    plain: true,
    sites,
    origin: siteOrigin,
    body: `<div class="hero">
  <div class="summary">
    <div class="item-image">${tile(theme)}</div>
    <div class="summary-text">
      <h1>${esc(theme.name)}</h1>
      <div class="meta"><span>${esc(theme.author || "Unknown")}</span><span class="date">${esc(formatDate(theme.updatedAt))}</span></div>
      <div class="actions">${themeActions(theme)}</div>
    </div>
  </div>
</div>
<main id="post-content">
  <p class="lead">${esc(theme.description)}</p>
  ${theme.screenshot ? `<p class="shot"><img src="${esc(theme.screenshot)}" alt="${esc(`${theme.name} in Typora`)}" onerror="this.hidden=true"></p>` : ""}
  ${theme.readme ?? ""}
</main>`,
  });
}

/** A section of the Documents page. */
const section = (id, title, items, more = null) => `<section class="doc" id="${id}">
  <h2># ${esc(title)}</h2>
  <ul>${items.map((item) => `<li><p>${item}</p></li>`).join("")}</ul>
  ${more ? `<a class="more-content" href="${esc(more)}">Read More...</a>` : ""}
</section>`;

export function docPage({ assets, origin: siteOrigin, sites }) {
  return layout({
    title: "Theme Documents — Typora",
    description: "How to install, write and submit a theme for Typora 2.0.",
    canonical: `${siteOrigin}/doc/`,
    assets,
    plain: true,
    sites,
    origin: siteOrigin,
    body: `<main id="docs">
${section(
  "install",
  "How to install a theme",
  [
    "Open a theme in this gallery and click <em>Install</em>. Typora opens <em>Settings ▸ Extensions</em> and asks before installing it.",
    "Or click <em>Download</em> and open the <code>.typora-theme</code> file. Typora opens <em>Settings ▸ View</em>, installs it once you agree and switches to it.",
    "Choose an installed theme in <em>Settings ▸ View</em> or in the <em>Themes</em> menu. Uninstall it from <em>Settings ▸ Extensions</em>.",
  ],
  GUIDE_URL,
)}
${section(
  "write",
  "How to write a theme",
  [
    "A theme is a folder with a <code>theme.toml</code>: variables for fonts, sizes and colours, then element styles for headings, quotes, code and tables.",
    "Save it under <em>Themes/</em> in the folder that <em>Settings ▸ View ▸ Open Folder</em> shows, and choose it. Typora reloads it when you switch back to the app.",
    "Add a <code>theme.css</code> only for decoration <code>theme.toml</code> cannot express.",
  ],
  WRITE_URL,
)}
${section(
  "submit",
  "How to submit a theme",
  [
    `Fork <a href="${REPO_URL}">typora/typora-extensions</a> on GitHub.`,
    "Add your theme as <code>themes/&lt;your.id&gt;/</code>: a <code>typora-extension.json</code> that contributes only themes, with the tag <code>Theme</code>, and the theme folders it names.",
    "Add <code>cover.webp</code> (5:4, at least 1000 pixels wide) and <code>screenshot.webp</code> (1760 × 1100), Typora showing the theme.",
    "Run <code>npm run validate</code>, then open a pull request. CI packages what was reviewed as <code>&lt;your.id&gt;-&lt;version&gt;.typora-theme</code>.",
  ],
  `${REPO_URL}/blob/main/CONTRIBUTING.md`,
)}
${section(
  "typora-1",
  "Themes from Typora 1",
  [
    `Themes on <a href="${V1_GALLERY}">theme.typora.io</a> are written for Typora 1 and do not work in Typora 2.0. The themes Typora made have been rebuilt here.`,
    "To bring another one along, give its link to the chat in Typora and ask for it to be installed, or convert it by hand.",
  ],
  `${WRITE_URL}#converting-a-typora-1-theme`,
)}
${section(
  "about",
  "About this Site",
  [
    `Hosted on <a href="${REPO_URL}">GitHub</a>. Every theme here is reviewed and built from source by Typora's CI.`,
    `Contact <a href="mailto:hi@typora.io">hi@typora.io</a>.`,
  ],
)}
</main>`,
  });
}

export function themeNotFoundPage({ assets, origin: siteOrigin, sites }) {
  return layout({
    title: "Not found — Typora Themes",
    description: "This page does not exist.",
    canonical: null,
    assets,
    plain: true,
    noindex: true,
    sites,
    origin: siteOrigin,
    body: `<main id="post-content" class="notfound"><h1>Not found</h1><p>There is no theme or page here.</p><p><a class="btn" href="/">Back to the gallery</a></p></main>`,
  });
}
