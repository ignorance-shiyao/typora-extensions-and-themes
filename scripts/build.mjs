#!/usr/bin/env node
// Build the two sites of this repository:
//
//   dist/extensions (extensions.typora.io)
//     index.json                        catalog (schemaVersion 1) of everything,
//                                       themes included: the app reads this one
//     suggestions.json                  the app's curated install suggestions
//     download/<id>-<version>.typora-extension, .typora-theme
//                                       one deterministic package (a zip) each
//     index.html, <id>/index.html, 404.html, robots.txt, sitemap.xml
//     assets/*                          content-hashed CSS / JS / icon / images
//
//   dist/themes (theme2.typora.io)
//     download/<id>-<version>.typora-theme
//     index.html, doc/index.html, <id>/index.html, 404.html, robots.txt, sitemap.xml
//     assets/*
//
//   node scripts/build.mjs                  the two production origins
//   node scripts/build.mjs --dev            http://localhost:8788 and :8789 (npm run dev)
//   node scripts/build.mjs --origin <url> --themes-origin <url> --docs-origin <url> --home-origin <url>

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  BUILT_IN_THEMES_DIR,
  CONTRIBUTION_KEYS,
  DOCS_ORIGIN,
  EXTENSION_PACKAGE,
  HOME_ORIGIN,
  REPO_URL,
  OS_NAMES,
  ROOT,
  SITE_ORIGIN,
  THEME_PACKAGE,
  THEMES_SITE_ORIGIN,
  checkManifest,
  checkThemePackage,
  gitTime,
  isoSeconds,
  packageDir,
  packageFiles,
  packageIds,
  packagePath,
  readManifest,
  storeImage,
  TAGS,
  themeHead,
  themeIds,
  tierOf,
  zip,
} from "./lib.mjs";
import { esc, extensionPage, homePage, notFoundPage, renderMarkdown } from "./site.mjs";
import { docPage, galleryPage, themeNotFoundPage, themePage } from "./themes-site.mjs";

const args = process.argv.slice(2);
const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const dev = args.includes("--dev");
const origin = (flag("--origin") ?? (dev ? "http://localhost:8788" : SITE_ORIGIN)).replace(/\/$/, "");
const themesOrigin = (flag("--themes-origin") ?? (dev ? "http://localhost:8789" : THEMES_SITE_ORIGIN)).replace(/\/$/, "");
/** The four sites in the header; docs and the homepage are not served locally. */
const sites = {
  docs: (flag("--docs-origin") ?? DOCS_ORIGIN).replace(/\/$/, ""),
  extensions: origin,
  themes: themesOrigin,
  home: (flag("--home-origin") ?? HOME_ORIGIN).replace(/\/$/, ""),
};
const DIST = join(ROOT, "dist");
/** `extensions.install { url }` in every host (docs/extensions-host.md). */
const MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024;

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const now = process.env.SOURCE_DATE_EPOCH ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000) : new Date();
const write = (site, rel, data) => {
  const path = join(DIST, site, rel);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, data);
};

rmSync(DIST, { recursive: true, force: true });

// ── Assets (content-hashed so /assets/* can be cached forever) ─────────
const siteAssets = (site, files) => {
  const assets = {};
  for (const [key, file] of files) {
    const data = readFileSync(join(ROOT, "site", site, file));
    const [base, ext] = file.split(".");
    const name = `assets/${base}.${sha256(data).slice(0, 10)}.${ext}`;
    write(site, name, data);
    assets[key] = `/${name}`;
  }
  write(site, "favicon.png", readFileSync(join(ROOT, "site", site, "favicon.png")));
  write(site, "fonts/texgyreadventor-regular.otf", readFileSync(join(ROOT, "site/fonts/texgyreadventor-regular.otf")));
  return assets;
};
const assets = siteAssets("extensions", [["css", "style.css"], ["js", "app.js"], ["favicon", "favicon.png"]]);
const themeAssets = siteAssets("themes", [["css", "style.css"], ["js", "app.js"], ["favicon", "favicon.png"]]);

/** Store images of the package in `dir`, content-hashed under /assets. */
function storeImages(site, siteOrigin, dir, id) {
  const images = {};
  for (const kind of ["cover", "screenshot"]) {
    const name = storeImage(dir, kind);
    if (!name) continue;
    const data = readFileSync(join(dir, name));
    const path = `assets/${kind}s/${id}.${sha256(data).slice(0, 10)}.${name.split(".").pop().toLowerCase()}`;
    write(site, path, data);
    images[kind] = `${siteOrigin}/${path}`;
  }
  return images;
}

// ── Packages + catalog ─────────────────────────────────────────────────
const entries = [];
const pages = [];
let failed = false;

const THEME_IDS = themeIds();

for (const id of packageIds()) {
  const dir = packageDir(id);
  const isTheme = THEME_IDS.includes(id);
  let manifest;
  try {
    manifest = readManifest(id);
  } catch (error) {
    console.error(`✗ ${id}: ${error.message}`);
    failed = true;
    continue;
  }
  const { errors } = checkManifest(manifest, dir, id);
  if (isTheme) errors.push(...checkThemePackage(manifest, dir));
  if (errors.length) {
    console.error(`✗ ${id}: ${errors.join(" ")} (run npm run validate)`);
    failed = true;
    continue;
  }

  const files = packageFiles(dir);
  const archive = zip(files.map((name) => ({ name, data: readFileSync(join(dir, name)) })));
  if (archive.length > MAX_DOWNLOAD_BYTES) {
    console.error(`✗ ${id}: the package is ${(archive.length / 1024 / 1024).toFixed(1)} MB; the app downloads at most 50 MB.`);
    failed = true;
    continue;
  }
  const packageName = `${id}-${manifest.version}${isTheme ? THEME_PACKAGE : EXTENSION_PACKAGE}`;
  write("extensions", `download/${packageName}`, archive);
  if (isTheme) write("themes", `download/${packageName}`, archive);

  const contributes = Object.keys(manifest.contributes ?? {}).filter((k) => CONTRIBUTION_KEYS.includes(k));
  if (manifest.main !== undefined) contributes.push("main");
  if (manifest.background !== undefined) contributes.push("background");

  const images = isTheme ? storeImages("themes", themesOrigin, dir, id) : storeImages("extensions", origin, dir, id);

  const entry = {
    id,
    name: manifest.name.trim(),
    version: manifest.version,
    description: typeof manifest.description === "string" ? manifest.description : "",
    author: typeof manifest.author === "string" ? manifest.author : "",
    repository: `${REPO_URL}/tree/main/${packagePath(id)}`,
    keywords: Array.isArray(manifest.keywords) ? manifest.keywords.filter((k) => typeof k === "string") : [],
    ...(manifest.unlisted === true ? { unlisted: true } : {}),
    tags: TAGS.filter((t) => Array.isArray(manifest.tags) && manifest.tags.includes(t)),
    // Platforms it runs on; absent means all of them.
    ...(Array.isArray(manifest.os) && manifest.os.length
      ? { os: Object.keys(OS_NAMES).filter((key) => manifest.os.includes(key)) }
      : {}),
    ...images,
    engines: manifest.engines && typeof manifest.engines === "object" ? manifest.engines : {},
    permissions: manifest.permissions && typeof manifest.permissions === "object" ? manifest.permissions : {},
    contributes,
    tier: tierOf(manifest, files),
    // Language packs: the app finds the pack for a UI or spelling language by these.
    localizations: (manifest.contributes?.localizations ?? []).map((l) => l.locale),
    dictionaries: (manifest.contributes?.dictionaries ?? []).map((d) => d.language),
    page: `${isTheme ? themesOrigin : origin}/${id}/`,
    download: { url: `${origin}/download/${packageName}`, sha256: sha256(archive), size: archive.length },
    updatedAt: gitTime(packagePath(id)) ?? isoSeconds(now),
  };
  entries.push(entry);

  const readmeName = readdirSync(dir).find((f) => /^readme\.md$/i.test(f));
  const readme = readmeName
    ? renderMarkdown(readFileSync(join(dir, readmeName), "utf8"), `${REPO_URL}/blob/main/extensions/${id}`)
    : null;
  pages.push({ entry, manifest, files, readme, isTheme });
  console.log(`✓ ${id} ${manifest.version} ${entry.tier} ${packageName} ${archive.length} B ${entry.download.sha256.slice(0, 12)}…`);
}

if (failed) {
  console.error("\nBuild failed.");
  process.exit(1);
}

const catalog = { schemaVersion: 1, generatedAt: isoSeconds(now), extensions: entries };
write("extensions", "index.json", `${JSON.stringify(catalog, null, 2)}\n`);
write("extensions", "suggestions.json", readFileSync(join(ROOT, "suggestions.json")));

const robots = (siteOrigin) => `User-agent: *\nAllow: /\nDisallow: /download/\n\nSitemap: ${siteOrigin}/sitemap.xml\n`;
const sitemap = (urls) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${esc(u.loc)}</loc><lastmod>${u.lastmod}</lastmod></url>`)
    .join("\n")}\n</urlset>\n`;

// ── Extensions site ────────────────────────────────────────────────────
// Language packs after the rest, so they do not crowd out the other extensions.
const isPack = (e) => e.tags.includes("Language Pack");
const extensionPages = pages.filter((page) => !page.isTheme);
const extensionEntries = extensionPages.map((page) => page.entry);
const byName = [...extensionEntries].sort((a, b) => isPack(a) - isPack(b) || a.name.localeCompare(b.name, "en"));
write("extensions", "index.html", homePage({ entries: byName, assets, origin, sites }));
for (const page of extensionPages) write("extensions", `${page.entry.id}/index.html`, extensionPage({ ...page, assets, origin, sites }));
write("extensions", "404.html", notFoundPage({ assets, origin, sites }));
write("extensions", "robots.txt", robots(origin));
const listedEntries = extensionEntries.filter((e) => e.unlisted !== true);
const latest = listedEntries.map((e) => e.updatedAt).sort().at(-1) ?? isoSeconds(now);
write(
  "extensions",
  "sitemap.xml",
  sitemap([{ loc: `${origin}/`, lastmod: latest }, ...listedEntries.map((e) => ({ loc: e.page, lastmod: e.updatedAt }))]),
);

// ── Themes site ────────────────────────────────────────────────────────
const themes = pages
  .filter((page) => page.isTheme && page.manifest.unlisted !== true)
  .map(({ entry, manifest, readme }) => ({
    ...entry,
    slug: entry.id,
    readme,
    colorSchemes: [...new Set(manifest.contributes.themes.map((path) => themeHead(join(packageDir(entry.id), path, "theme.toml")).colorScheme))],
  }));
const builtIn = existsSync(BUILT_IN_THEMES_DIR)
  ? readdirSync(BUILT_IN_THEMES_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => {
        const dir = join(BUILT_IN_THEMES_DIR, d.name);
        const info = JSON.parse(readFileSync(join(dir, "theme.json"), "utf8"));
        return {
          ...info,
          ...storeImages("themes", themesOrigin, dir, d.name),
          slug: d.name,
          builtIn: true,
          author: "Typora",
          colorSchemes: [info.colorScheme],
          updatedAt: gitTime(`themes/built-in/${d.name}`) ?? isoSeconds(now),
          page: `${themesOrigin}/${d.name}/`,
        };
      })
  : [];
const gallery = [...themes, ...builtIn].sort((a, b) => a.name.localeCompare(b.name, "en"));
write("themes", "index.html", galleryPage({ themes: gallery, assets: themeAssets, origin: themesOrigin, sites }));
write("themes", "doc/index.html", docPage({ assets: themeAssets, origin: themesOrigin, sites }));
for (const theme of gallery) write("themes", `${theme.slug}/index.html`, themePage({ theme, assets: themeAssets, origin: themesOrigin, sites }));
write("themes", "404.html", themeNotFoundPage({ assets: themeAssets, origin: themesOrigin, sites }));
write("themes", "robots.txt", robots(themesOrigin));
const newest = gallery.map((t) => t.updatedAt).sort().at(-1) ?? isoSeconds(now);
write(
  "themes",
  "sitemap.xml",
  sitemap([
    { loc: `${themesOrigin}/`, lastmod: newest },
    { loc: `${themesOrigin}/doc/`, lastmod: newest },
    ...gallery.map((t) => ({ loc: t.page, lastmod: t.updatedAt })),
  ]),
);

console.log(`\n${extensionEntries.length} extension(s) → dist/extensions (${origin})`);
console.log(`${gallery.length} theme(s), ${themes.length} packaged → dist/themes (${themesOrigin})`);
