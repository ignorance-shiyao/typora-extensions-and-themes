#!/usr/bin/env node
// Store images for the language packs (extensions/typora.lang-*):
//   cover.webp       800×400, the card on extensions.typora.io
//   screenshot.webp  1760×1100, the extension's page
// (Lossy WebP: the gradient makes PNGs ten times larger. Chromium's canvas
// encodes it, so nothing else needs installing.)
// Each shows the language's own name and a Typora window whose File menu is
// in that language, taken from the pack's translations.
//
//   node scripts/language-pack-images.mjs                 every pack
//   node scripts/language-pack-images.mjs typora.lang-ja  only these
//
// Needs Playwright, which is not a dependency of this repository:
//   npm install --no-save --no-package-lock playwright && npx playwright install chromium
// Run on macOS so every script (CJK, Arabic, Devanagari, Thai …) has a
// system font.

import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXTENSIONS_DIR, extensionIds, readManifest } from "./lib.mjs";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("Playwright is missing: npm install --no-save --no-package-lock playwright && npx playwright install chromium");
  process.exit(2);
}

const MENUS = ["File", "Edit", "Paragraph", "Format", "View", "Themes", "Window", "Help"];
const FILE_MENU = ["New", "New Window", "New Tab", "—", "Open Recent ›", "—", "Save", "Export ›", "—", "Settings…", "Close"];
const SIZES = { cover: [400, 200], screenshot: [880, 550] };
const RTL = /^(ar|fa|he|ur)(-|$)/;

const esc = (value) => String(value).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** A stable hue per locale, so neighbouring cards differ. */
function hue(locale) {
  let h = 0;
  for (const c of locale) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

/** What one pack's picture shows, or null for a pack that is not a language pack. */
function describe(id) {
  const dir = join(EXTENSIONS_DIR, id);
  const manifest = readManifest(id);
  const [l10n] = manifest.contributes?.localizations ?? [];
  if (l10n) {
    const strings = JSON.parse(readFileSync(join(dir, l10n.path), "utf8"));
    const t = (s) => {
      const [text, arrow] = s.split(" ›");
      return (strings[text] || text) + (arrow === undefined ? "" : " ›");
    };
    return {
      locale: l10n.locale,
      name: l10n.name,
      englishName: l10n.englishName && l10n.englishName !== l10n.name ? l10n.englishName : "",
      menus: MENUS.map(t),
      body: `<div class="dropdown">${FILE_MENU.map((s) => (s === "—" ? "<hr>" : `<div>${esc(t(s))}</div>`)).join("")}</div>`,
      title: t("Untitled"),
    };
  }
  const dictionaries = manifest.contributes?.dictionaries ?? [];
  if (!dictionaries.length) return null;
  return {
    locale: dictionaries[0].language,
    name: manifest.name.replace(/ Spelling Dictionaries$/, ""),
    englishName: "Spelling dictionaries",
    menus: MENUS,
    body: `<p class="line">The fox <span class="typo">jumsp</span> over the dog.</p>
      <div class="dropdown suggest"><div>jumps</div><div>jump</div><div>jumbs</div><hr><div>Learn Spelling</div></div>`,
    title: "Untitled",
  };
}

function page(p) {
  const h = hue(p.locale);
  const dir = RTL.test(p.locale) ? "rtl" : "ltr";
  return `<!doctype html><html lang="${esc(p.locale)}" dir="${dir}"><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  html, body { width: 100%; height: 100%; overflow: hidden; }
  body {
    display: flex; align-items: center; gap: 4%; padding: 0 0 0 7%;
    font: 6.5vh/1.35 -apple-system, BlinkMacSystemFont, "Helvetica Neue", "PingFang SC", "Hiragino Sans", "Apple SD Gothic Neo", sans-serif;
    color: oklch(25% 0.02 ${h});
    background: radial-gradient(120% 140% at 0% 0%, oklch(98% 0.025 ${h}), oklch(91% 0.06 ${h}));
  }
  [dir=rtl] body { padding: 0 7% 0 0; }
  .text { flex: 0 0 43%; min-width: 0; }
  .label { white-space: nowrap; font-size: 0.72em; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.55; }
  [dir=rtl] .label { letter-spacing: 0; }
  .name { font-size: 2.6em; font-weight: 700; letter-spacing: -0.02em; line-height: 1.12; margin: 0.15em 0 0.2em; white-space: nowrap; }
  .english { font-size: 0.95em; opacity: 0.6; white-space: nowrap; }
  .window {
    flex: 1; align-self: flex-end; height: 82%; min-width: 0;
    background: #fff; border-radius: 0.75em 0 0 0; overflow: hidden;
    box-shadow: 0 0 0 0.5px oklch(0% 0 0 / 0.18), 0 1em 2.5em oklch(30% 0.05 ${h} / 0.22);
  }
  [dir=rtl] .window { border-radius: 0 0.75em 0 0; }
  .titlebar { position: relative; height: 2em; display: flex; align-items: center; gap: 0.45em; padding: 0 0.75em; background: #f6f6f6; }
  .titlebar i { width: 0.75em; height: 0.75em; border-radius: 50%; background: #ff5f57; }
  .titlebar i:nth-child(2) { background: #febc2e; } .titlebar i:nth-child(3) { background: #28c840; }
  .titlebar span { position: absolute; inset: 0 3.5em; display: flex; align-items: center; justify-content: center; font-size: 0.85em; opacity: 0.6; }
  .menubar { display: flex; gap: 1.1em; height: 1.85em; align-items: center; padding: 0 0.75em; white-space: nowrap; overflow: hidden;
    border-bottom: 1px solid #e8e8e8; font-size: 0.9em; mask-image: linear-gradient(to ${dir === "rtl" ? "left" : "right"}, #000 80%, transparent); }
  .menubar span:first-child { padding: 0.08em 0.45em; margin: 0 -0.45em; border-radius: 0.3em; background: oklch(60% 0.15 ${h}); color: #fff; }
  .doc { position: relative; padding: 1.1em 1.4em; }
  .dropdown { position: absolute; top: 0; inset-inline-start: 0.45em; min-width: 52%; padding: 0.3em; background: #fff; border-radius: 0.55em;
    box-shadow: 0 0 0 0.5px oklch(0% 0 0 / 0.2), 0 0.6em 1.7em oklch(0% 0 0 / 0.16); font-size: 0.9em; }
  .dropdown div { padding: 0.15em 0.8em; border-radius: 0.3em; white-space: nowrap; }
  .dropdown div:first-child { background: oklch(60% 0.15 ${h}); color: #fff; }
  .dropdown hr { border: 0; border-top: 1px solid #ececec; margin: 0.25em 0.6em; }
  .line { font-size: 1.05em; white-space: nowrap; }
  .typo { text-decoration: underline wavy #e5484d; text-underline-offset: 0.2em; }
  .suggest { top: 3.1em; inset-inline-start: 4.6em; min-width: 0; }
</style><body>
  <div class="text">
    <div class="label">Typora Language Pack</div>
    <div class="name">${esc(p.name)}</div>
    ${p.englishName ? `<div class="english">${esc(p.englishName)}</div>` : ""}
  </div>
  <div class="window">
    <div class="titlebar"><i></i><i></i><i></i><span>${esc(p.title)}</span></div>
    <div class="menubar">${p.menus.map((m) => `<span>${esc(m)}</span>`).join("")}</div>
    <div class="doc">${p.body}</div>
  </div>
  <script>
    // Long names shrink to fit their column (run after each resize).
    window.fit = () => {
      const name = document.querySelector(".name");
      name.style.fontSize = "";
      let size = parseFloat(getComputedStyle(name).fontSize);
      while (name.scrollWidth > name.parentElement.clientWidth && size > 8) name.style.fontSize = (size -= 0.5) + "px";
    };
  </script>
</body></html>`;
}

const wanted = process.argv.slice(2);
const ids = (wanted.length ? wanted : extensionIds()).filter((id) => id.startsWith("typora.lang-"));
const browser = await chromium.launch();
const tab = await browser.newPage({ deviceScaleFactor: 2 });
for (const id of ids) {
  const picture = describe(id);
  if (!picture) continue;
  await tab.setContent(page(picture));
  for (const [file, [width, height]] of Object.entries(SIZES)) {
    await tab.setViewportSize({ width, height });
    await tab.evaluate(async () => {
      await document.fonts.ready;
      window.fit();
    });
    for (const ext of ["png", "jpg", "jpeg"]) rmSync(join(EXTENSIONS_DIR, id, `${file}.${ext}`), { force: true });
    const png = (await tab.screenshot()).toString("base64");
    const webp = await tab.evaluate(async (data) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const canvas = Object.assign(document.createElement("canvas"), { width: image.width, height: image.height });
      canvas.getContext("2d").drawImage(image, 0, 0);
      return canvas.toDataURL("image/webp", 0.88).split(",")[1];
    }, png);
    writeFileSync(join(EXTENSIONS_DIR, id, `${file}.webp`), Buffer.from(webp, "base64"));
  }
  console.log(`✓ ${id}: ${picture.name}`);
}
await browser.close();
