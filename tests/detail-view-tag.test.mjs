import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { TAGS, readManifest } from "../scripts/lib.mjs";
import { homePage, tagSlug } from "../scripts/site.mjs";

test("Detail View replaces View in the catalog and store filters", () => {
  assert.ok(TAGS.includes("Detail View"));
  assert.ok(!TAGS.includes("View"));
  assert.equal(tagSlug("Detail View"), "detail-view");
  const entry = { ...readManifest("typora.tasks"), tier: "L0", permissions: {}, keywords: [] };
  assert.ok(entry.tags.includes("Detail View"));
  const html = homePage({ entries: [entry], assets: {}, origin: "https://extensions.typora.io" });
  assert.match(html, /data-tag="detail-view"/);
  assert.match(html, />Detail View<\/button>/);
  assert.doesNotMatch(html, /data-tag="view"/);
  const script = readFileSync(new URL("../site/extensions/app.js", import.meta.url), "utf8");
  assert.match(script, /if \(tag === "view"\) tag = "detail-view"/);
});
