// New feature coverage; existing browser specs are intentionally unchanged.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { build, transform } from "esbuild";
import { chromium, webkit } from "playwright";

test("official Markmap layouts, styles, native animated folds and level menu", { timeout: 30000 }, async () => {
  const repo = fileURLToPath(new URL("../../", import.meta.url));
  const extension = resolve(repo, "extensions/extensions/typora.mindmap");
  const sdk = await transform(await readFile(resolve(repo, "packages/workbench/src/extensions/view/viewSdk.ts"), "utf8"), { loader: "ts" });
  const bundle = await build({
    stdin: { resolveDir: repo, contents: `
      import {PanelConnection} from './packages/workbench/src/extensions/panels.ts';
      window.saved={}; window.logs=[]; window.navigations=[];
      window.panel=new PanelConnection({extensionId:'typora.mindmap',entry:'view/index.html',kind:'detail',title:'Mind Map',
        onConnect:panel=>panel.emit('document',{blocks:[
          {id:'a',type:'heading',depth:0,attrs:{level:1},text:'# Python Cheatsheet'},
          {id:'b',type:'heading',depth:0,attrs:{level:2},text:'## Variables & Data Types'},
          {id:'c',type:'heading',depth:0,attrs:{level:3},text:'### Basic types'},
          {id:'d',type:'heading',depth:0,attrs:{level:2},text:'## Strings'}
        ]}),onEvent:(type,data)=>{if(type==='log')window.logs.push(data);},
        handlers:{reveal:range=>window.navigations.push(range),'storage.get':key=>window.saved[key],'storage.set':({key,value})=>{window.saved[key]=value;}}
      });
      panel.iframe.src='/ext/view/index.html'; document.querySelector('.wb-detail').append(panel.element);
      // The actual WorkBench hide/restore behavior has separate component tests.
      new MutationObserver(()=>document.querySelector('.wb-detail').classList.toggle('wb-detail--hidden',panel.element.classList.contains('wb-extension-surface--fullsize'))).observe(panel.element,{attributes:true,attributeFilter:['class']});
    ` }, bundle: true, format: "esm", write: false,
    plugins: [{ name: "host-fixture", setup(builder) {
      builder.onResolve({ filter: /^@typemark\/common$/ }, () => ({ path: "common", namespace: "fixture" }));
      builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: "export const env={isClient:true};export const bridge=()=>({invoke:async()=>{}});" }));
    } }],
  });
  const css = await readFile(resolve(repo, "packages/workbench/src/styles/workbench.css"));
  const server = createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (req.url === "/") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end('<!doctype html><link rel="stylesheet" href="/style.css"><style>body{margin:0}.wb-root{flex-direction:row}.files{width:220px;flex:none;background:#ddd}.wb-editor-stack{flex:1}.wb-titlebar{height:40px}.wb-detail{width:320px;box-sizing:border-box}.wb-detail.wb-detail--hidden{width:0}</style><div class="wb-root"><aside class="files">Files</aside><div class="wb-editor-stack"><header class="wb-titlebar">Document</header></div><aside class="wb-detail"></aside></div><script type="module" src="/host.js"></script>'); return;
    }
    if (req.url === "/host.js") { res.setHeader("Content-Type", "text/javascript"); res.end(bundle.outputFiles[0].text); return; }
    if (req.url === "/style.css") { res.setHeader("Content-Type", "text/css; charset=utf-8"); res.end(css); return; }
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
    const page = await browser.newPage({ viewport: { width: 1000, height: 720 }, reducedMotion: "no-preference" });
    page.setDefaultTimeout(5000);
    const errors = []; page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const toolbar = page.getByRole("toolbar", { name: "Mind map controls" });
    await toolbar.getByRole("button", { name: "Mind map options", exact: true }).waitFor();
    const frame = page.frames()[1];
    const branch = frame.locator('[data-key="node:b"]'), leaf = frame.locator('[data-key="node:c"]');
    await leaf.waitFor();
    await frame.waitForFunction(() => document.querySelector('[data-key="node:b"]').getAttribute('aria-expanded') === 'true');
    assert.equal(await toolbar.getByRole("button", { name: "Fit mind map", exact: true }).count(), 0);
    const colors = await frame.locator('#map [data-key^="edge:"] path').evaluateAll((paths) => [...new Set(paths.map(path => getComputedStyle(path).stroke))]);
    assert.ok(colors.length > 1, "default palette has multiple branch colors");
    await branch.locator('text').first().click();
    await frame.waitForFunction(() => document.querySelector('[data-key="node:b"]').getAttribute('aria-expanded') === 'false');
    assert.equal(await leaf.count(), 1, "outgoing child stays during native animation");
    await leaf.waitFor({ state: "detached" });
    await branch.locator('text').first().click(); await leaf.waitFor(); await page.waitForTimeout(600);
    await leaf.locator('text').first().click();
    await page.waitForFunction(() => window.navigations.some(item => item.blockId === 'c'));
    const select = async (name) => {
      await toolbar.getByRole('button', { name: 'Mind map options', exact: true }).click();
      await page.getByRole('menuitemradio', { name, exact: true }).click();
      await page.waitForTimeout(600);
    };
    await select('Two-sided');
    assert.equal(await page.evaluate(() => window.saved['mindmap.options'].layout), 'two-sided');
    await select('Org chart');
    assert.ok((await leaf.boundingBox()).y > (await branch.boundingBox()).y, 'org-chart grows down');
    await select('Tree'); await select('Cards');
    await page.screenshot({ path: '/private/tmp/typora-mindmap-cards.png' });
    await select('Minimal'); await page.screenshot({ path: '/private/tmp/typora-mindmap-minimal.png' });
    await select('Classic'); await select('Level 1'); await branch.waitFor({ state: 'detached' });
    await select('All levels'); await leaf.waitFor();
    const viewport = await frame.locator('#map > g').getAttribute('transform');
    const identity = await frame.evaluate(() => window.identityMarker = Math.random());
    await toolbar.getByRole('button', { name: 'Full size', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.wb-detail').getBoundingClientRect().width === 0);
    const bounds = await page.locator('.wb-extension-surface--fullsize').boundingBox();
    assert.equal(bounds.x, 220); assert.equal(bounds.width, 780);
    await page.waitForTimeout(600);
    await toolbar.getByRole('button', { name: 'Mind map options', exact: true }).click();
    await page.screenshot({ path: '/private/tmp/typora-mindmap-options.png' });
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.wb-extension-surface--fullsize').count(), 1);
    await frame.locator('[data-key="node:a"]').focus(); await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelector('.wb-detail').getBoundingClientRect().width === 320);
    assert.equal((await page.locator('.files').boundingBox()).width, 220);
    assert.equal(await frame.locator('#map > g').getAttribute('transform'), viewport);
    assert.equal(await frame.evaluate(() => window.identityMarker), identity);
    assert.deepEqual(await page.evaluate(() => window.logs), []); assert.deepEqual(errors, []);
    await page.evaluate(() => window.panel.dispose());
  } finally {
    await browser?.close(); server.closeAllConnections();
    await new Promise((done) => server.close(done));
  }
});
