#!/usr/bin/env node
// Published downloads are immutable (CONTRIBUTING.md): before a deploy,
// compare the catalog just built with the one live, and refuse a version
// whose package bytes changed. Run after scripts/build.mjs:
//
//   node scripts/immutable.mjs [https://extensions.typora.io]
//
// Exit code 1 when a published id@version would change.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, SITE_ORIGIN } from "./lib.mjs";

const origin = (process.argv[2] ?? SITE_ORIGIN).replace(/\/+$/, "");
const built = JSON.parse(readFileSync(join(ROOT, "dist", "extensions", "index.json"), "utf8"));

const response = await fetch(`${origin}/index.json`, { headers: { "Cache-Control": "no-cache" } });
if (response.status === 404) {
  console.log(`${origin}/index.json does not exist yet: nothing published to compare.`);
  process.exit(0);
}
if (!response.ok) {
  console.error(`${origin}/index.json: HTTP ${response.status}`);
  process.exit(2);
}
const live = await response.json();
const published = new Map((live.extensions ?? []).map((e) => [`${e.id}@${e.version}`, e.download?.sha256]));

const changed = [];
for (const entry of built.extensions ?? []) {
  const before = published.get(`${entry.id}@${entry.version}`);
  if (before && entry.download?.sha256 && before !== entry.download.sha256) changed.push(`${entry.id}@${entry.version}`);
}
if (changed.length) {
  for (const key of changed) {
    const message = `${key} is published with different bytes; bump its version instead of changing a published package.`;
    console.log(process.env.GITHUB_ACTIONS ? `::error::${message}` : `✗ ${message}`);
  }
  process.exit(1);
}
console.log(`✓ ${built.extensions?.length ?? 0} package(s): no published version changes its bytes.`);
