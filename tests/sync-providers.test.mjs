import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import assert from "node:assert/strict";
function load(id, fetch) {
  let handler;
  runInNewContext(readFileSync(new URL(`../extensions/typora.sync-${id}/main.js`, import.meta.url), "utf8"), {
    typora: {sync: {registerProvider: (_id, fn) => {handler = fn;}}, net: {fetch}},
    Uint8Array, TextEncoder, Blob, URLSearchParams, crypto, atob, btoa,
  });
  return handler;
}
const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), {status, headers});
test("Dropbox uses revision-conditional uploads and deletes", async () => {
  const calls = [];
  const run = load("dropbox", async (url, options) => {calls.push({url, options}); return json({rev: "new"});});
  assert.equal(await run({op: "write", root: "/Notes", path: "你好.md", accessToken: "token", data: btoa("hello"), version: "old"}), "new");
  const args = JSON.parse(calls[0].options.headers["Dropbox-API-Arg"]);
  assert.deepEqual(args.mode, {".tag": "update", update: "old"});
  assert.equal(args.path, "/Notes/你好.md");
  assert.equal(args.strict_conflict, true);
  await run({op: "remove", root: "/Notes", path: "你好.md", accessToken: "token", version: "old"});
  assert.equal(JSON.parse(calls[1].options.body).parent_rev, "old");
});
test("Dropbox does not interpret authorization errors as missing files", async () => {
  const run = load("dropbox", async () => json({error_summary: "expired_access_token"}, 401));
  const result = await run({op: "stat", root: "/Notes", path: "a.md", accessToken: "expired"});
  assert.equal(result.error.status, 401);
});
test("Google Drive preserves ambiguous duplicate names", async () => {
  const run = load("google-drive", async () => json({files: [{id: "1", name: "same.md"}, {id: "2", name: "same.md"}]}));
  const result = await run({op: "list", root: "folder", accessToken: "token"});
  assert.equal(result.error.status, 409);
});
test("Google Drive rejects upload acknowledgements paired with a newer version", async () => {
  const calls = [];
  const run = load("google-drive", async (url, options) => {
    calls.push({url, options});
    if (url.includes("?q=")) return json({files: [{id: "file", name: "a.md", mimeType: "text/plain"}]});
    if (options.method === "PATCH") return json({id: "file"});
    if (url.endsWith("?alt=media")) return new Response("other user's edit");
    return json({id: "file", name: "a.md", mimeType: "text/plain"}, 200, {etag: "new"});
  });
  const result = await run({op: "write", root: "folder", path: "a.md", accessToken: "token", version: "old", data: btoa("my edit")});
  assert.equal(result.error.status, 412);
  assert.equal(calls.find(c => c.options.method === "PATCH").options.headers["If-Match"], "old");
});

test("Dropbox exposes its account root without calling get_metadata with an empty path", async () => {
  const run = load("dropbox", async () => {throw Error("unexpected metadata call");});
  const result = await run({op: "stat", root: "", path: "", accessToken: "token"});
  assert.equal(result.directory, true);
  assert.equal(result.path, "");
});
