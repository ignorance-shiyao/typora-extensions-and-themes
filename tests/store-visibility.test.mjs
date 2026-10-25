import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { ROOT, EXTENSIONS_DIR, checkManifest, readManifest } from "../scripts/lib.mjs";
import { homePage } from "../scripts/site.mjs";

test("unlisted must be a boolean and Data Sync is a valid tag", () => {
  const id = "typora.sync-dropbox";
  const manifest = readManifest(id);
  for (const unlisted of [undefined, false, true]) {
    const result = checkManifest({ ...manifest, unlisted }, join(EXTENSIONS_DIR, id), id);
    assert.deepEqual(result.errors, []);
    assert.ok(!result.warnings.some((warning) => warning.includes("unlisted")));
  }
  for (const unlisted of ["true", 1, null]) {
    assert.ok(checkManifest({ ...manifest, unlisted }, join(EXTENSIONS_DIR, id), id).errors.includes("unlisted must be a boolean."));
  }
});

test("built store hides development extensions while preserving direct pages and packages", () => {
  execFileSync(process.execPath, ["scripts/build.mjs"], { cwd: ROOT, stdio: "pipe" });
  const read = (path) => readFileSync(join(ROOT, "dist", path), "utf8");
  const home = read("index.html");
  const sitemap = read("sitemap.xml");
  const catalog = JSON.parse(read("index.json"));
  assert.match(home, /data-tag="data-sync"/);
  assert.match(home, /class="card" href="\/typora.mermaid\/"/);
  assert.match(sitemap, /\/typora.mermaid\//);
  assert.doesNotMatch(read("typora.mermaid/index.html"), /name="robots" content="noindex"/);
  for (const id of ["typora.sync-dropbox", "typora.sync-google-drive"]) {
    assert.ok(!home.includes(id));
    assert.ok(!sitemap.includes(id));
    const page = read(`${id}/index.html`);
    assert.match(page, /name="robots" content="noindex"/);
    assert.match(page, /Data Sync/);
    assert.ok(page.includes(`typora://extension/${id}`));
    const entry = catalog.extensions.find((entry) => entry.id === id);
    assert.equal(entry.unlisted, true);
    assert.deepEqual(entry.tags, ["Data Sync"]);
    assert.ok(existsSync(join(ROOT, "dist", new URL(entry.download.url).pathname)));
    // Publishing again (false or omitted) restores the card and search data.
    for (const unlisted of [false, undefined]) {
      const html = homePage({ entries: [{ ...entry, unlisted }], assets: {}, origin: "https://extensions.typora.io" });
      assert.ok(html.includes(`class="card" href="/${id}/"`));
    }
  }
});
