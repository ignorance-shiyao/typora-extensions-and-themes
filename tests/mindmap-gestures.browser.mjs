// New gesture coverage. Run with TOOLBAR_BROWSER=webkit for WKWebView behavior.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { build } from "esbuild";
import { chromium, webkit } from "playwright";

test("trackpad scroll pans, pinch zooms, native controls use arrow cursors", { timeout: 20000 }, async () => {
  const repo = fileURLToPath(new URL("../../", import.meta.url));
  const extension = resolve(repo, "extensions/extensions/typora.mindmap");
  const css = await readFile(resolve(repo, "packages/workbench/src/styles/workbench.css"));
  const native = await build({
    stdin: { resolveDir: repo, contents: `import {installMacPreviewMagnification} from './packages/workbench/platform/mac/previewMagnification.ts';window.magnification=[];window.disposeMagnification=installMacPreviewMagnification();` },
    bundle: true, format: "esm", write: false,
    plugins: [{ name: "bridge", setup(builder) {
      builder.onResolve({ filter: /^@typemark\/common$/ }, () => ({ path: "common", namespace: "fixture" }));
      builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: "export const bridge=()=>({invoke:async(method,{enabled})=>window.magnification.push(enabled)});" }));
    } }],
  });
  const server = createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (req.url === "/") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end('<!doctype html><link rel="stylesheet" href="/style.css"><div class="wb-extension-surface" style="width:700px;height:500px"><iframe title="Mind map" sandbox="allow-scripts" src="/ext/view/index.html" style="border:0;width:100%;height:100%"></iframe></div><div class="wb-extension-toolbar"><button id="host-button">Host</button></div><div class="wb-extension-menu"><button id="host-menu">Menu</button></div><script type="module" src="/native.js"></script>'); return;
    }
    if (req.url === "/native.js") { res.setHeader("Content-Type", "text/javascript"); res.end(native.outputFiles[0].text); return; }
    if (req.url === "/style.css") { res.setHeader("Content-Type", "text/css; charset=utf-8"); res.end(css); return; }
    res.setHeader("Content-Security-Policy", `default-src 'none'; script-src http://${req.headers.host}/ext/; style-src http://${req.headers.host}/ext/ 'unsafe-inline'; connect-src 'none'`);
    if (req.url === "/ext/__typora/view.js") {
      res.setHeader("Content-Type", "text/javascript");
      res.end(`window.typora={view:{capabilities:{},theme:{dark:false},storage:{get:async()=>null,set:async()=>{}},onTheme:()=>{},onFullsize:callback=>window.fullsizeCallback=callback,reveal:async()=>{},log:message=>{throw new Error(message)},onDocument:callback=>callback({blocks:[{id:'a',type:'heading',depth:0,attrs:{level:1},text:'# Root'},{id:'b',type:'heading',depth:0,attrs:{level:2},text:'## Child'}]})}};`); return;
    }
    try {
      const path = resolve(extension, new URL(req.url, "http://localhost").pathname.replace(/^\/ext\//, ""));
      if (!path.startsWith(extension + "/")) throw new Error("Not found");
      res.setHeader("Content-Type", ({ ".js": "text/javascript", ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8" })[extname(path)] ?? "text/plain");
      res.end(await readFile(path));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  let browser;
  try {
    browser = await (process.env.TOOLBAR_BROWSER === "webkit" ? webkit : chromium).launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1000, height: 720 }, reducedMotion: "no-preference" });
    page.setDefaultTimeout(5000);
    const errors = []; page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const frame = page.frames()[1];
    await frame.locator('[data-key="node:b"]').waitFor();
    const state = () => frame.locator("#map > g").evaluate((group) => {
      const values = group.getAttribute("transform").match(/translate\(([^,]+),([^)]+)\) scale\(([^)]+)\)/);
      return { x: Number(values[1]), y: Number(values[2]), k: Number(values[3]) };
    });
    const wheel = (deltaX, deltaY, ctrlKey = false, deltaMode = 0) => frame.evaluate((options) => {
      const event = new WheelEvent("wheel", { ...options, clientX: 200, clientY: 200, bubbles: true, cancelable: true });
      document.getElementById("map").dispatchEvent(event); return event.defaultPrevented;
    }, { deltaX, deltaY, ctrlKey, deltaMode });
    const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.000001, `${actual} != ${expected}`);
    const start = await state();
    assert.equal(await wheel(37, 59), true);
    const pan = await state(); near(pan.k, start.k); near(pan.x, start.x - 37); near(pan.y, start.y - 59);
    await wheel(0, -30, true);
    const pinch = await state(); assert.ok(pinch.k > pan.k);
    near((200 - pinch.x) / pinch.k, (200 - pan.x) / pan.k);
    near((200 - pinch.y) / pinch.k, (200 - pan.y) / pan.k);
    await wheel(-12, 23);
    const mixed = await state(); near(mixed.k, pinch.k); near(mixed.x, pinch.x + 12); near(mixed.y, pinch.y - 23);
    await wheel(1, 2, false, 1);
    const lines = await state(); near(lines.k, mixed.k); near(lines.x, mixed.x - 16); near(lines.y, mixed.y - 32);

    const gesture = (type, scale) => frame.evaluate(({ type, scale }) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      const rect = document.getElementById("map").getBoundingClientRect();
      Object.assign(event, { scale, clientX: rect.left + 200, clientY: rect.top + 200 });
      document.getElementById("map").dispatchEvent(event); return event.defaultPrevented;
    }, { type, scale });
    assert.equal(await gesture("gesturestart", 1), true);
    assert.equal(await gesture("gesturechange", 1.4), true);
    const safari = await state(); near(safari.k, lines.k * 1.4);
    await wheel(0, -20, true); near((await state()).k, safari.k);
    await gesture("gestureend", 1.4);
    await frame.getByRole("button", { name: "Zoom in", exact: true }).click();
    await frame.waitForTimeout(80);
    await wheel(10, 15);
    const interrupted = await state();
    await frame.waitForTimeout(600);
    assert.deepEqual(await state(), interrupted, "scroll stops the running zoom animation");
    await frame.evaluate(() => window.fullsizeCallback({ fullsize: true }));
    const recreated = await state(); await wheel(10, 20);
    const recreatedPan = await state(); near(recreatedPan.x, recreated.x - 10); near(recreatedPan.y, recreated.y - 20); near(recreatedPan.k, recreated.k);

    assert.equal(await page.locator('#host-button').evaluate((button) => getComputedStyle(button).cursor), 'default');
    assert.equal(await page.locator('#host-menu').evaluate((button) => getComputedStyle(button).cursor), 'default');
    assert.equal(await frame.locator('#options').evaluate((button) => getComputedStyle(button).cursor), 'default');
    await page.mouse.move(300, 250);
    await page.waitForFunction(() => window.magnification.at(-1) === false);
    await page.mouse.move(950, 100);
    await page.waitForFunction(() => window.magnification.at(-1) === true);
    await page.evaluate(() => document.querySelector('.wb-extension-surface').classList.add('wb-extension-surface--fullsize'));
    await page.waitForFunction(() => window.magnification.at(-1) === false);
    await page.evaluate(() => document.querySelector('.wb-extension-surface').classList.remove('wb-extension-surface--fullsize'));
    await page.waitForFunction(() => window.magnification.at(-1) === true);
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close(); server.closeAllConnections();
    await new Promise((done) => server.close(done));
  }
});
