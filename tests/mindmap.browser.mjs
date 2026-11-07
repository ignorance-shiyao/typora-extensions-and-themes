// Optional browser check from the monorepo: node --test extensions/tests/mindmap.browser.mjs
// Requires Playwright and its Chromium browser. The store's dependency-free tests
// remain `node --test tests/*.test.mjs`.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { chromium } from "playwright";
import { transform } from "esbuild";

test("mind map renders offline in the real SDK sandbox and keeps interaction state", { timeout: 30000 }, async () => {
  const root = fileURLToPath(new URL("../extensions/typora.mindmap/", import.meta.url));
  const sdkSource = await readFile(new URL("../../packages/workbench/src/extensions/view/viewSdk.ts", import.meta.url), "utf8");
  const { code: sdk } = await transform(sdkSource, { loader: "ts" });
  const server = createServer(async (req, res) => {
    const origin = `http://${req.headers.host}`;
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (req.url === "/") {
      res.setHeader("Content-Type", "text/html");
      res.end('<iframe title="Mind Map" sandbox="allow-scripts" src="/ext/view/index.html" style="width:320px;height:650px;border:0"></iframe>');
      return;
    }
    res.setHeader("Content-Security-Policy", `default-src 'none'; script-src ${origin}/ext/; style-src ${origin}/ext/ 'unsafe-inline'; img-src data: blob:; connect-src 'none'; base-uri 'none'; form-action 'none'`);
    try {
      if (req.url === "/ext/__typora/view.js") {
        res.setHeader("Content-Type", "text/javascript");
        res.end(sdk);
        return;
      }
      const path = resolve(root, new URL(req.url, origin).pathname.replace(/^\/ext\//, ""));
      if (!path.startsWith(root.endsWith(sep) ? root : root + sep)) throw new Error("Not found");
      res.setHeader("Content-Type", ({ ".html": "text/html", ".js": "text/javascript", ".css": "text/css" })[extname(path)] ?? "text/plain");
      res.end(await readFile(path));
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 700, height: 700 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (entry) => { if (entry.type() === "error") errors.push(entry.text()); });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const frame = page.frames()[1];
    await frame.waitForFunction(() => window.typora?.view && window.markmap);
    await page.evaluate(() => new Promise((done) => {
      const channel = new MessageChannel();
      window.messages = [];
      window.extensionPort = channel.port1;
      channel.port1.onmessage = ({ data }) => {
        window.messages.push(data);
        if (data.type === "ready") done();
        if (data.t === "req") channel.port1.postMessage({ t: "res", id: data.id, ok: true });
      };
      document.querySelector("iframe").contentWindow.postMessage({ typora: "connect", kind: "detail", theme: {
        dark: false, vars: { "--typora-panel": "#ffffff", "--typora-foreground": "#303030", "--typora-accent": "#3578c8" },
      } }, "*", [channel.port2]);
    }));
    const send = (payload) => page.evaluate((payload) => window.extensionPort.postMessage({ t: "event", type: "document", payload }), payload);
    const outline = [
      { id: "a", level: 1, text: "项目规划" },
      { id: "b", level: 3, text: "实现细节" },
      { id: "c", level: 5, text: "这是一个很长的中文标题，用来确认窄侧栏中的自动换行" },
      { id: "d", level: 2, text: '<img src="https://evil.invalid/x" onerror="alert(1)">' },
    ];
    await send({ blocks: [], outline: [] });
    await frame.getByText("No headings in this document.").waitFor();
    await send({ blocks: [], outline });
    await frame.locator('[data-block-id="c"]').waitFor({ state: "visible" });
    await frame.getByRole("button", { name: "Fit mind map", exact: true }).click();
    await frame.locator('[data-block-id="b"]').click();
    await page.waitForFunction(() => window.messages.some((msg) => msg.type === "reveal" && msg.payload.blockId === "b"));
    assert.equal(await frame.locator("img").count(), 0);
    await frame.getByRole("button", { name: "Collapse 实现细节", exact: true }).focus();
    await page.keyboard.press("Enter");
    await frame.locator('[data-block-id="c"]').waitFor({ state: "detached" });
    await frame.getByRole("button", { name: "Zoom in", exact: true }).click();
    const transform = () => frame.locator("#map > g").first().getAttribute("transform");
    const before = await transform();
    await send({ blocks: [{ id: "body", text: "body edit" }], outline });
    await frame.waitForTimeout(100);
    assert.equal(await transform(), before);
    await send({ blocks: [], outline: outline.map((node) => node.id === "b" ? { ...node, text: "实现方案" } : node) });
    await frame.getByRole("button", { name: "Expand 实现方案", exact: true }).waitFor();
    assert.equal(await frame.locator('[data-block-id="c"]').count(), 0);
    assert.equal(await transform(), before);
    await frame.getByRole("button", { name: "Expand 实现方案", exact: true }).click();
    await frame.locator('[data-block-id="c"]').waitFor({ state: "visible" });
    await frame.getByRole("button", { name: "Fit mind map", exact: true }).click();
    await page.screenshot({ path: "/private/tmp/typora-mindmap-light.png" });
    await page.evaluate(() => window.extensionPort.postMessage({ t: "event", type: "theme", payload: {
      dark: true, vars: { "--typora-panel": "#252525", "--typora-foreground": "#ededed", "--typora-accent": "#83aef0" },
    } }));
    await frame.waitForFunction(() => document.documentElement.dataset.theme === "dark");
    await page.screenshot({ path: "/private/tmp/typora-mindmap-dark.png" });
    assert.deepEqual(errors, []);
    assert.equal(await page.evaluate(() => window.messages.filter((msg) => msg.type === "log").length), 0);
  } finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
  }
});
