#!/usr/bin/env node
// Build the store into dist/:
//   dist/index.json                     catalog (schemaVersion 1)
//   dist/download/<id>-<version>.typora-extension
//                                       one deterministic package (a zip) per extension
//   dist/index.html, dist/<id>/index.html, 404.html, robots.txt, sitemap.xml
//   dist/assets/*                       content-hashed CSS / JS / icon
//
//   node scripts/build.mjs                      https://extensions.typora.io
//   node scripts/build.mjs --dev                http://localhost:8788 (npm run dev)
//   node scripts/build.mjs --origin <url>

import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  CONTRIBUTION_KEYS,
  EXTENSIONS_DIR,
  REPO_URL,
  OS_NAMES,
  ROOT,
  SITE_ORIGIN,
  checkManifest,
  extensionIds,
  gitTime,
  isoSeconds,
  packageFiles,
  readManifest,
  storeImage,
  TAGS,
  tierOf,
  zip,
} from "./lib.mjs";
import { esc, extensionPage, homePage, notFoundPage, renderMarkdown } from "./site.mjs";

const args = process.argv.slice(2);
const originArg = args.includes("--origin") ? args[args.indexOf("--origin") + 1] : null;
const origin = (originArg ?? (args.includes("--dev") ? `http://localhost:${process.env.PORT ?? 8788}` : SITE_ORIGIN)).replace(/\/$/, "");
const DIST = join(ROOT, "dist");
/** `extensions.install { url }` in every host (docs/extensions-host.md). */
const MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024;

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const now = process.env.SOURCE_DATE_EPOCH ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000) : new Date();
const write = (rel, data) => {
  const path = join(DIST, rel);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, data);
};

rmSync(DIST, { recursive: true, force: true });
mkdirSync(join(DIST, "download"), { recursive: true });

// ── Assets (content-hashed so /assets/* can be cached forever) ─────────
const assets = {};
for (const [key, file] of [["css", "style.css"], ["js", "app.js"], ["favicon", "favicon.png"], ["icon", "typora-icon.png"]]) {
  const data = readFileSync(join(ROOT, "site", file));
  const [base, ext] = file.split(".");
  const name = `assets/${base}.${sha256(data).slice(0, 10)}.${ext}`;
  write(name, data);
  assets[key] = `/${name}`;
}
write("favicon.png", readFileSync(join(ROOT, "site", "favicon.png")));

// ── Packages + catalog ─────────────────────────────────────────────────
const entries = [];
const pages = [];
let failed = false;

for (const id of extensionIds()) {
  const dir = join(EXTENSIONS_DIR, id);
  let manifest;
  try {
    manifest = readManifest(id);
  } catch (error) {
    console.error(`✗ ${id}: ${error.message}`);
    failed = true;
    continue;
  }
  const { errors } = checkManifest(manifest, dir, id);
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
  const packageName = `${id}-${manifest.version}.typora-extension`;
  write(`download/${packageName}`, archive);

  const contributes = Object.keys(manifest.contributes ?? {}).filter((k) => CONTRIBUTION_KEYS.includes(k));
  if (manifest.main !== undefined) contributes.push("main");
  if (manifest.background !== undefined) contributes.push("background");

  // Store images, content-hashed under /assets like the site's files.
  const images = {};
  for (const kind of ["cover", "screenshot"]) {
    const name = storeImage(dir, kind);
    if (!name) continue;
    const data = readFileSync(join(dir, name));
    const path = `assets/${kind}s/${id}.${sha256(data).slice(0, 10)}.${name.split(".").pop().toLowerCase()}`;
    write(path, data);
    images[kind] = `${origin}/${path}`;
  }

  const entry = {
    id,
    name: manifest.name.trim(),
    version: manifest.version,
    description: typeof manifest.description === "string" ? manifest.description : "",
    author: typeof manifest.author === "string" ? manifest.author : "",
    repository: `${REPO_URL}/tree/main/extensions/${id}`,
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
    page: `${origin}/${id}/`,
    download: { url: `${origin}/download/${packageName}`, sha256: sha256(archive), size: archive.length },
    updatedAt: gitTime(`extensions/${id}`) ?? isoSeconds(now),
  };
  entries.push(entry);

  const readmeName = readdirSync(dir).find((f) => /^readme\.md$/i.test(f));
  const readme = readmeName
    ? renderMarkdown(readFileSync(join(dir, readmeName), "utf8"), `${REPO_URL}/blob/main/extensions/${id}`)
    : null;
  pages.push({ entry, manifest, files, readme });
  console.log(`✓ ${id} ${manifest.version} ${entry.tier} ${packageName} ${archive.length} B ${entry.download.sha256.slice(0, 12)}…`);
}

if (failed) {
  console.error("\nBuild failed.");
  process.exit(1);
}

const catalog = { schemaVersion: 1, generatedAt: isoSeconds(now), extensions: entries };
write("index.json", `${JSON.stringify(catalog, null, 2)}\n`);

// ── Site ───────────────────────────────────────────────────────────────
// Language packs after the rest, so they do not crowd out the other extensions.
const isPack = (e) => e.tags.includes("Language Pack");
const byName = [...entries].sort((a, b) => isPack(a) - isPack(b) || a.name.localeCompare(b.name, "en"));
write("index.html", homePage({ entries: byName, assets, origin }));
for (const page of pages) write(`${page.entry.id}/index.html`, extensionPage({ ...page, assets, origin }));
write("404.html", notFoundPage({ assets, origin }));
write("robots.txt", `User-agent: *\nAllow: /\nDisallow: /download/\n\nSitemap: ${origin}/sitemap.xml\n`);
const listedEntries = entries.filter((e) => e.unlisted !== true);
const latest = listedEntries.map((e) => e.updatedAt).sort().at(-1) ?? isoSeconds(now);
const urls = [
  { loc: `${origin}/`, lastmod: latest },
  ...listedEntries.map((e) => ({ loc: e.page, lastmod: e.updatedAt })),
];
write(
  "sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${esc(u.loc)}</loc><lastmod>${u.lastmod}</lastmod></url>`)
    .join("\n")}\n</urlset>\n`,
);

console.log(`\n${entries.length} extension(s) → dist/ (origin ${origin})`);
