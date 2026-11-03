import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import worker from "../worker.js";

const config = readFileSync(new URL("../wrangler.themes.toml", import.meta.url), "utf8");
const canonicalHost = config.match(/^CANONICAL_HOST = "([^"]+)"/m)[1];

test("old theme links redirect to the new host with their path and query", async () => {
  assert.equal(canonicalHost, "themes.typora.io");
  for (const host of ["theme2.typora.io", canonicalHost]) {
    assert.ok(config.includes(`pattern = "${host}/*"`));
  }
  const response = await worker.fetch(
    new Request("https://theme2.typora.io/typora.ash/?from=gallery"),
    { CANONICAL_HOST: canonicalHost, ASSETS: { fetch() { assert.fail("redirect must precede asset serving"); } } },
  );
  assert.equal(response.status, 301);
  assert.equal(response.headers.get("location"), "https://themes.typora.io/typora.ash/?from=gallery");
});

test("the new theme host serves assets without redirecting", async () => {
  const response = await worker.fetch(
    new Request("https://themes.typora.io/typora.ash/"),
    { CANONICAL_HOST: canonicalHost, ASSETS: { fetch: async () => new Response("theme page") } },
  );
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "theme page");
});
