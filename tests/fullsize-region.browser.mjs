// node --test extensions/tests/fullsize-region.browser.mjs (monorepo, Playwright Chromium)
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { build, transform } from "esbuild";
import { chromium, webkit } from "playwright";

test("fullsize covers editor plus detail while preserving the file sidebar", { timeout: 30000 }, async () => {
  const repo = fileURLToPath(new URL("../../", import.meta.url));
  const extension = resolve(repo, "extensions/extensions/typora.mindmap");
  const sdk = await transform(await readFile(resolve(repo, "packages/workbench/src/extensions/view/viewSdk.ts"), "utf8"), { loader: "ts" });
  const host = await build({
    stdin: { resolveDir: repo, contents: `
      import { PanelConnection } from './packages/workbench/src/extensions/panels.ts';
      window.copies = []; window.logs = []; window.navigations = [];
      window.panel = new PanelConnection({
        extensionId: 'typora.mindmap', entry: 'view/index.html', title: 'Mind Map', kind: 'detail',
        onConnect: (panel) => panel.emit('document', {blocks: [
          {id:'a',type:'heading',depth:0,attrs:{level:1},text:'# Python Cheatsheet'},
          {id:'b',type:'heading',depth:0,attrs:{level:2},text:'## Variables & Data Types'},
          {id:'c',type:'heading',depth:0,attrs:{level:3},text:'### Basic types'},
          {id:'d',type:'heading',depth:0,attrs:{level:2},text:'## Strings'},
        ]}),
        onEvent: (type, data) => { if(type==='log') window.logs.push(data); },
        handlers: { reveal: (range) => window.navigations.push(range) },
      });
      window.panel.iframe.src='/ext/view/index.html';
      document.querySelector('.wb-detail').append(window.panel.element);
      // Layout fixture: WorkBench visibility/preference behavior is covered
      // by WorkBench.extensionFullsize.test.tsx against the actual component.
      const detail=document.querySelector('.wb-detail');
      new MutationObserver(()=>detail.classList.toggle('wb-detail--hidden', window.panel.element.classList.contains('wb-extension-surface--fullsize'))).observe(window.panel.element,{attributes:true,attributeFilter:['class']});
    ` },
    bundle: true, format: "esm", write: false,
    plugins: [{ name: "test-host-bridge", setup(builder) {
      builder.onResolve({ filter: /^@typemark\/common$/ }, () => ({ path: "common", namespace: "fixture" }));
      builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: `
        export const env = {isClient:true};
        export const THEME_SURFACE_ATTR='data-ty-chrome-surface';
        export const THEME_FULLSCREEN_SIDEBAR_ATTR='data-ty-chrome-fullscreen-sidebar';
        export const bridge=()=>({invoke:async(method, data)=>{
          if(method!=='clipboard.writeText') throw new Error('Unexpected bridge method');
          window.copies.push(data.text);
        }});
      ` }));
    } }],
  });
  const css = await readFile(resolve(repo, "packages/workbench/src/styles/workbench.css"));
  const server = createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (req.url === "/") {
      res.setHeader("Content-Type", "text/html");
      res.end(`<!doctype html><link rel="stylesheet" href="/workbench.css"><style>
        body{margin:0}.wb-root{display:flex;flex-direction:row;height:100vh}.wb-editor-stack{flex:1}.wb-titlebar{height:40px}
        .wb-detail{width:320px;box-sizing:border-box;position:relative}.files{width:220px;flex:none;background:#ddd}.wb-detail.wb-detail--hidden{width:0}.wb-extension-surface{min-height:0}
      </style><div class="wb-root"><aside class="files">Files</aside><div class="wb-editor-stack"><header class="wb-titlebar">Document</header></div><aside class="wb-detail"></aside></div><script type="module" src="/host.js"></script>`);
      return;
    }
    if (req.url === "/host.js") { res.setHeader("Content-Type", "text/javascript"); res.end(host.outputFiles[0].text); return; }
    if (req.url === "/workbench.css") { res.setHeader("Content-Type", "text/css"); res.end(css); return; }
    res.setHeader("Content-Security-Policy", `default-src 'none'; script-src http://${req.headers.host}/ext/; style-src http://${req.headers.host}/ext/ 'unsafe-inline'; connect-src 'none'`);
    if (req.url === "/ext/__typora/view.js") { res.setHeader("Content-Type", "text/javascript"); res.end(sdk.code); return; }
    try {
      const path = resolve(extension, new URL(req.url, "http://localhost").pathname.replace(/^\/ext\//, ""));
      if (!path.startsWith(extension + "/")) throw new Error("Not found");
      res.setHeader("Content-Type", ({ ".js": "text/javascript", ".html": "text/html", ".css": "text/css" })[extname(path)] ?? "text/plain");
      res.end(await readFile(path));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  let browser;
  try {
    browser = await (process.env.TOOLBAR_BROWSER === "webkit" ? webkit : chromium).launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1000, height: 720 } });
    page.setDefaultTimeout(5000);
    if (process.env.TOOLBAR_POPOVER === "off") await page.addInitScript(() => {
      HTMLElement.prototype.showPopover = undefined;
      HTMLElement.prototype.hidePopover = undefined;
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const toolbar = page.getByRole("toolbar", { name: "Mind map controls" });
    await toolbar.getByRole("button", { name: "Full size", exact: true }).waitFor();
    const frame = page.frames()[1];
    await frame.locator('[data-block-id="c"]').waitFor();
    await frame.getByRole("button", { name: "Collapse Variables & Data Types", exact: true }).click();
    await frame.locator('[data-block-id="c"]').waitFor({ state: "detached" });
    await toolbar.getByRole("button", { name: "Zoom in", exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('[data-button-id="zoom-in"]').disabled);
    const transform = () => frame.locator("#map > g").first().getAttribute("transform");
    const before = await transform();
    const marker = await frame.evaluate(() => window.identityMarker = Math.random());
    const rect = await toolbar.boundingBox();
    await page.screenshot({ path: "/private/tmp/typora-fullsize-region-panel.png" });
    assert.ok(Math.abs(rect.x + rect.width / 2 - 840) < 2, "pill centered in the 320px detail panel");
    assert.ok(rect.y > 650, "pill floats at the bottom");
    await page.screenshot({ path: "/private/tmp/typora-fullsize-region-panel.png" });
    await toolbar.getByRole("button", { name: "Full size", exact: true }).click();
    await page.locator(".wb-extension-surface--fullsize").waitFor();
    await frame.waitForFunction(() => window.typora.view.fullsize);
    const bounds = await page.locator(".wb-extension-surface--fullsize").boundingBox();
    assert.equal(bounds.x, 220);
    assert.equal(bounds.width, 780);
    await page.waitForFunction(() => document.querySelector(".wb-detail").getBoundingClientRect().width === 0);
    assert.equal((await page.locator(".files").boundingBox()).width, 220);
    assert.equal(bounds.y, 40);
    assert.equal(bounds.height, 680);
    assert.equal(await frame.evaluate(() => window.identityMarker), marker, "same frame survives fullsize");
    assert.equal(await frame.locator('[data-block-id="c"]').count(), 0, "folds survive fullsize");
    await frame.waitForFunction((previous) => document.querySelector("#map > g").getAttribute("transform") !== previous, before);
    await page.screenshot({ path: "/private/tmp/typora-fullsize-region-expanded.png" });
    await frame.locator('[data-block-id="a"]').focus();
    await page.keyboard.press("Escape");
    await frame.waitForFunction(() => !window.typora.view.fullsize);
    await frame.waitForFunction((expected) => document.querySelector("#map > g").getAttribute("transform") === expected, before);
    assert.equal(await frame.evaluate(() => window.identityMarker), marker);
    await toolbar.getByRole("button", { name: "Full size", exact: true }).click();
    await toolbar.getByRole("button", { name: "Exit full size", exact: true }).click();
    await frame.waitForFunction(() => !window.typora.view.fullsize);

    await page.waitForFunction(() => document.querySelector(".wb-detail").getBoundingClientRect().width === 320);
    assert.equal((await page.locator(".files").boundingBox()).width, 220);
    assert.equal(await frame.evaluate(() => window.identityMarker), marker);
    assert.deepEqual(await page.evaluate(() => window.logs), []);
    assert.deepEqual(errors, []);
    await page.evaluate(() => window.panel.dispose());
    assert.equal(await page.locator(".wb-extension-surface").count(), 0);
  } finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
  }
});
