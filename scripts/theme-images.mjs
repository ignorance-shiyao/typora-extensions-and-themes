#!/usr/bin/env node
// Store images for the themes, taken from the real app (Electron) showing
// scripts/theme-sample.md:
//   screenshot.webp  1760×1100, the theme's page on theme2.typora.io
//   cover.webp       500×400, the gallery tile; half light, half dark for an
//                    `auto` theme
//
//   node scripts/theme-images.mjs                   every theme, built-in ones too
//   node scripts/theme-images.mjs typora.ash github only these
//   node scripts/theme-images.mjs --app ../Typora-V2
//
// Needs a Typora-V2 checkout with a built Electron app (`npx electron-vite
// build` in apps/electron) and its Playwright. By default that is the parent
// folder, where this repository is a submodule. Windows stay invisible and
// take no clicks while the script runs.

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { BUILT_IN_THEMES_DIR, ROOT, THEMES_DIR, readManifest, themeHead, themeIds } from "./lib.mjs";

const args = process.argv.slice(2);
const appFlag = args.indexOf("--app");
const APP = resolve(appFlag >= 0 ? args.splice(appFlag, 2)[1] : join(ROOT, ".."));
const wanted = new Set(args);

const MAIN = join(APP, "apps/electron/out/main/index.js");
if (!existsSync(MAIN)) {
  console.error(`No Electron build at ${MAIN}. Run npx electron-vite build in apps/electron.`);
  process.exit(2);
}
const { _electron } = createRequire(join(APP, "packages/typemark/package.json"))("@playwright/test");
const ELECTRON = join(
  APP,
  "node_modules/.pnpm",
  readdirSync(join(APP, "node_modules/.pnpm")).find((name) => name.startsWith("electron@")),
  "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron",
);

// A 1100×688 window at 1.6x makes the 1760×1100 screenshot.
const WINDOW = { width: 1100, height: 688, scale: 1.6 };
const COVER = { width: 500, height: 400 };
const NOTES = ["Reading list.md", "Sample.md", "Style guide.md"];

const WRAPPER = `
import { app } from "electron";
// Only the sample is the user's argument; the app skips the first two.
process.argv = [process.argv[0], "typora", process.argv.at(-1)];
app.setPath("appData", process.env.TY_DATA);
app.setPath("userData", process.env.TY_DATA + "/user");
app.commandLine.appendSwitch("force-device-scale-factor", "${WINDOW.scale}");
app.setActivationPolicy?.("accessory");
app.on("browser-window-created", (_event, win) => {
  win.setOpacity(0);
  win.setIgnoreMouseEvents(true);
  win.webContents.setBackgroundThrottling(false);
});
await import(${JSON.stringify(MAIN)});
`;

/** Every theme to shoot: `{ slug, id, dir, extension?, colorScheme? }`. */
function targets() {
  const out = [];
  for (const slug of themeIds()) {
    const dir = join(THEMES_DIR, slug);
    const [path] = readManifest(slug).contributes.themes;
    const { colorScheme } = themeHead(join(dir, path, "theme.toml"));
    out.push({ slug, id: `${slug}/${path.split("/").pop()}`, dir, extension: dir, colorScheme });
  }
  for (const entry of readdirSync(BUILT_IN_THEMES_DIR, { withFileTypes: true })) {
    if (entry.isDirectory()) out.push({ slug: entry.name, id: entry.name, dir: join(BUILT_IN_THEMES_DIR, entry.name) });
  }
  return out.filter((target) => !wanted.size || wanted.has(target.slug));
}

const builtInScheme = (target) => JSON.parse(readFileSync(join(target.dir, "theme.json"), "utf8")).colorScheme;

const sampleFor = (slug) => join(ROOT, "scripts", slug === "typora.han" ? "theme-sample-zh.md" : "theme-sample.md");

function prepare(target, mode) {
  const home = mkdtempSync(join(tmpdir(), "typora-theme-"));
  const config = join(home, ".config/Typora");
  mkdirSync(config, { recursive: true });
  writeFileSync(
    join(config, "settings.toml"),
    `[general]\nlanguage = "en"\n\n[editor]\nspellCheck = false\n\n[markdown]\nhighlight = true\n\n[appearance]\ntheme = "${target.id}"\ndarkTheme = "${target.id}"\nmode = "${mode}"\n`,
  );
  if (target.extension) cpSync(target.extension, join(config, "Extensions", target.slug), { recursive: true });
  const notes = join(home, "Notes");
  mkdirSync(notes);
  for (const name of NOTES) cpSync(sampleFor(target.slug), join(notes, name));
  writeFileSync(join(home, "wrapper.mjs"), WRAPPER);
  return { home, file: join(notes, "Sample.md") };
}

async function launch(home, file, mode) {
  for (let attempt = 0; ; attempt++) {
    try {
      const app = await _electron.launch({
        executablePath: ELECTRON,
        args: [join(home, "wrapper.mjs"), file],
        colorScheme: mode === "dark" ? "dark" : "light",
        env: { ...process.env, HOME: home, TY_DATA: join(home, "data"), TYPORA_SKIP_LICENSE: "1" },
      });
      const page = await app.firstWindow();
      await page.waitForSelector(".ty-document .md-h1", { timeout: 30_000 });
      return { app, page };
    } catch (error) {
      execFileSync("pkill", ["-9", "-f", home], { stdio: "ignore" }).toString?.();
      if (attempt === 2) throw error;
    }
  }
}

// The button shows on hover, which never happens in a window nobody sees.
const toggleSidebar = (page) => page.evaluate(() => document.querySelector(".wb-titlebar-btn--sidebar").click());

async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
}

/** PNG buffers of one appearance: the window with its sidebar, then the page alone. */
async function shoot(target, mode) {
  const { home, file } = prepare(target, mode);
  try {
    const { app, page } = await launch(home, file, mode);
    await app.evaluate(
      ({ BrowserWindow }, { width, height }) => {
        const win = BrowserWindow.getAllWindows()[0];
        win.setContentSize(width, height);
      },
      WINDOW,
    );
    await page.addStyleTag({ content: "*{scrollbar-width:none}::-webkit-scrollbar{display:none}.wb-win-controls{visibility:hidden}" });
    await settle(page);
    const window = await page.screenshot();
    await toggleSidebar(page);
    await settle(page);
    const clip = await page.evaluate(({ width, height }) => {
      const heading = document.querySelector(".ty-document .md-h1").getBoundingClientRect();
      const top = document.querySelector(".wb-titlebar").getBoundingClientRect().bottom;
      const scale = Math.max(1, Math.min(1.4, (heading.width + 80) / width));
      const w = width * scale;
      const margin = Math.max(40, (w - heading.width) / 2);
      return { x: Math.max(0, heading.left - margin), y: top, width: w, height: height * scale };
    }, { width: 625, height: 500 });
    return { window, cover: await page.screenshot({ clip }) };
  } finally {
    try {
      execFileSync("pkill", ["-9", "-f", home], { stdio: "ignore" });
    } catch {
      /* gone */
    }
    rmSync(home, { recursive: true, force: true });
  }
}

/** Encode to WebP with Chromium's canvas; `covers` are drawn side by side. */
async function encoder() {
  const { chromium } = createRequire(join(APP, "packages/typemark/package.json"))("@playwright/test");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const webp = async (pngs, width, height, quality) => {
    const data = await page.evaluate(
      async ({ pngs, width, height, quality }) => {
        const images = await Promise.all(
          pngs.map(async (b64) => {
            const image = new Image();
            image.src = `data:image/png;base64,${b64}`;
            await image.decode();
            return image;
          }),
        );
        const canvas = Object.assign(document.createElement("canvas"), { width, height });
        const context = canvas.getContext("2d");
        context.imageSmoothingQuality = "high";
        const part = width / images.length;
        images.forEach((image, index) => {
          const scale = image.naturalWidth / width;
          context.drawImage(image, index * part * scale, 0, part * scale, image.naturalHeight, index * part, 0, part, height);
        });
        return canvas.toDataURL("image/webp", quality).split(",")[1];
      },
      { pngs: pngs.map((png) => png.toString("base64")), width, height, quality },
    );
    return Buffer.from(data, "base64");
  };
  return { webp, close: () => browser.close() };
}

const { webp, close } = await encoder();
for (const target of targets()) {
  const schemes = target.colorScheme === "auto" ? ["light", "dark"] : [target.colorScheme ?? builtInScheme(target)];
  const shots = [];
  for (const mode of schemes) shots.push(await shoot(target, mode));
  writeFileSync(join(target.dir, "screenshot.webp"), await webp([shots[0].window], 1760, 1100, 0.92));
  writeFileSync(join(target.dir, "cover.webp"), await webp(shots.map((shot) => shot.cover), COVER.width, COVER.height, 0.9));
  console.log(`✓ ${target.slug}`);
}
await close();
process.exit(0);
