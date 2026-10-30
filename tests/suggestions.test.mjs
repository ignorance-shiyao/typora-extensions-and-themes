import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { ROOT, checkSuggestions } from "../scripts/lib.mjs";

const list = () => JSON.parse(readFileSync(join(ROOT, "suggestions.json"), "utf8"));

test("the curated list agrees with the manifests", () => {
  assert.deepEqual(checkSuggestions(list()), []);
});

test("rejects entries that could not work", () => {
  const errorFor = (patch) => {
    const raw = list();
    Object.assign(raw.suggestions.find((item) => item.extension === "typora.d2"), patch);
    return checkSuggestions(raw).join("\n");
  };
  assert.match(errorFor({ extension: "typora.nope" }), /not in the store/);
  assert.match(errorFor({ surface: "toolbar" }), /surface must be/);
  assert.match(errorFor({ terms: ["D2"] }), /lowercase/);
  assert.match(errorFor({ runsPrograms: undefined }), /runsPrograms must be true/);
  assert.match(errorFor({ fence: "mermaid" }), /fence must be/);
  assert.match(errorFor({ extension: "typora.sync-dropbox", runsPrograms: undefined }), /unlisted/);
});
