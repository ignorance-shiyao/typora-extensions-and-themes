// Optional browser check from the monorepo: node --test extensions/tests/mindmap-blocks.browser.mjs
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

test("blocks-only document events render and update on a transparent background", { timeout: 30000 }, async () => {
  const root = fileURLToPath(new URL("../extensions/typora.mindmap/", import.meta.url));
  const sdkSource = await readFile(new URL("../../packages/workbench/src/extensions/view/viewSdk.ts", import.meta.url), "utf8");
  const { code: sdk } = await transform(sdkSource, { loader: "ts" });
  const server = createServer(async (req, res) => {
    const origin = `http://${req.headers.host}`;
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (req.url === "/") {
      res.setHeader("Content-Type", "text/html");
      res.end('<body style="margin:0;background:#e6ebf4"><iframe title="Mind Map" sandbox="allow-scripts" src="/ext/view/index.html" style="width:320px;height:650px;border:0"></iframe>');
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
    const blocks = [
      { id: "a", type: "heading", depth: 0, attrs: { level: 1 }, text: "# Python Cheatsheet" },
      { id: "b", type: "heading", depth: 0, attrs: { level: 2 }, text: "## Variables & **Data Types**" },
      { id: "quoted", type: "heading", depth: 1, attrs: { level: 2 }, text: "## Hidden quote" },
      { id: "c", type: "heading", depth: 0, attrs: { level: 3 }, text: "### Basic types" },
      { id: "d", type: "heading", depth: 0, attrs: { level: 2 }, text: "Strings\n---" },
    ];
    await send({ blocks });
    await frame.getByRole("button", { name: "Variables & Data Types", exact: true }).waitFor();
    assert.equal(await frame.locator('[data-block-id="quoted"]').count(), 0);
    assert.equal(await frame.getByText("Update Typora to display the document outline as a mind map.").count(), 0);
    assert.deepEqual(await frame.evaluate(() => [document.documentElement, document.body].map((node) => getComputedStyle(node).backgroundColor)), ["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0)"]);
    await frame.getByRole("button", { name: "Strings", exact: true }).click();
    await page.waitForFunction(() => window.messages.some((msg) => msg.type === "reveal" && msg.payload.blockId === "d"));
    await frame.getByRole("button", { name: "Collapse Variables & Data Types", exact: true }).click();
    await frame.locator('[data-block-id="c"]').waitFor({ state: "detached" });
    await send({ blocks: blocks.map((block) => block.id === "b" ? { ...block, text: "## Updated types" } : block) });
    await frame.getByRole("button", { name: "Expand Updated types", exact: true }).waitFor();
    assert.equal(await frame.locator('[data-block-id="c"]').count(), 0);
    await frame.getByRole("button", { name: "Expand Updated types", exact: true }).click();
    await frame.locator('[data-block-id="c"]').waitFor({ state: "visible" });
    await page.screenshot({ path: "/private/tmp/typora-mindmap-blocks-transparent.png" });
    await send({ blocks: [] });
    await frame.getByText("No headings in this document.").waitFor();
    await send({ blocks });
    await frame.getByRole("button", { name: "Python Cheatsheet", exact: true }).waitFor();
    assert.deepEqual(errors, []);
    assert.equal(await page.evaluate(() => window.messages.filter((msg) => msg.type === "log").length), 0);
  } finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
  }
});
