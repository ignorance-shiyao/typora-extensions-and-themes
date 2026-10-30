import { replaceImageSources } from "../extensions/typora.pika/convert.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { adapter as mataroa, activate as activateMataroa, checkKey as checkMataroa } from "../extensions/typora.mataroa/main.js";
import { adapter as writeas, signInWithPassword } from "../extensions/typora.writeas/main.js";
import { adapter as pika, checkKey as checkPika } from "../extensions/typora.pika/main.js";
import { adapter as wordpress } from "../extensions/typora.wordpress/adapter.js";
import { signInWithPassword as signInToWordPress } from "../extensions/typora.wordpress/main.js";
import { credential, signOut } from "../extensions/typora.writeas/shared.js";
import { TAGS } from "../scripts/lib.mjs";
const response = (data, status = 200, headers) => new Response(JSON.stringify(data), { status, headers });
function setup(settings, fetch) {
  const calls = [];
  const storage = new Map();
  const secrets = new Map();
  globalThis.typora = {
    settings: { get: key => key ? settings[key] : settings },
    storage: { get: async key => storage.get(key), set: async (key, value) => storage.set(key, value), remove: async key => storage.delete(key), keys: async () => [...storage.keys()] },
    secrets: {
      get: async key => secrets.get(key) ?? (key.startsWith("auth:") ? JSON.stringify({ username: "writer", password: "pass" }) : key.startsWith("publish-auth:") ? "test-token" : null),
      set: async (key, value) => { assert.equal(typeof value, "string"); secrets.set(key, value); },
      delete: async key => secrets.delete(key),
      keys: async () => [...secrets.keys()],
    },
    net: { fetch: async (url, options) => { calls.push({ url, options }); return fetch(url, options); } },
    document: { readImage: async () => ({ name: "cat.png", type: "image/png", bytes: new Uint8Array([1, 2, 3]) }) },
    ui: { toast: async () => {} },
  };
  return calls;
}
const source = { path: "/posts/a.md", markdown: "# Hello\n\nWorld" };
function commands() {
  const registered = new Map();
  typora.commands = { register: (id, handler) => (registered.set(id, handler), { dispose() {} }) };
  typora.publish = { registerAdapter: () => ({ dispose() {} }) };
  return registered;
}
test("A credential left in plain storage moves to secrets, and stays usable if it can't yet", async () => {
  setup({}, () => response({}));
  typora.secrets.get = async () => null;
  await typora.storage.set("auth:x", { username: "writer", password: "pass" });
  const moved = [];
  typora.secrets.set = async (key, value) => { moved.push([key, value]); };
  assert.deepEqual(JSON.parse(await credential("auth:x")), { username: "writer", password: "pass" });
  assert.deepEqual(moved, [["auth:x", JSON.stringify({ username: "writer", password: "pass" })]]);
  assert.deepEqual(await typora.storage.keys(), []);

  await typora.storage.set("publish-auth:y", "token");
  typora.secrets.set = async () => { throw new Error("No system keyring."); };
  assert.equal(await credential("publish-auth:y"), "token");
  assert.deepEqual(await typora.storage.keys(), ["publish-auth:y"]);
  assert.equal(await credential("missing"), null);
});
test("Sign Out clears secrets and anything an older version left behind", async () => {
  setup({}, () => response({}));
  await typora.secrets.set("publish-auth:a", "token");
  await typora.storage.set("publish-auth:b", "token");
  await typora.storage.set("publish:v1:c", "binding");
  await signOut();
  assert.deepEqual(await typora.secrets.keys(), []);
  assert.deepEqual(await typora.storage.keys(), ["publish:v1:c"]);
});
test("Mataroa and Pika check a key against their own service", async () => {
  const calls = setup({}, () => response({}));
  await checkMataroa("key");
  await checkPika("key");
  assert.deepEqual(calls.map(call => call.url), ["https://mataroa.blog/api/comments/pending/", "https://pika.page/micropub?q=config"]);
  assert.ok(calls.every(call => call.options.headers.Authorization === "Bearer key"));
});
test("An API key from the options form is kept only once the service accepts it", async () => {
  setup({ siteUrl: "https://me.mataroa.blog" }, () => response({ ok: true }));
  const accepted = commands();
  activateMataroa({ subscriptions: [] });
  await accepted.get("saveApiKey")({ apiKey: " key " });
  assert.equal(await typora.secrets.get("publish-auth:https://me.mataroa.blog"), "key");
  assert.deepEqual(await typora.storage.keys(), []);
  setup({ siteUrl: "https://me.mataroa.blog" }, () => response({ ok: false, error: "Not authorized." }, 403));
  let stored = false;
  typora.secrets.set = async () => { stored = true; };
  const rejected = commands();
  activateMataroa({ subscriptions: [] });
  await assert.rejects(rejected.get("saveApiKey")({ apiKey: "wrong" }), /Mataroa didn't accept this key/);
  assert.equal(stored, false);
});
test("WordPress keeps an Application Password only once the site accepts it", async () => {
  const site = { siteUrl: "https://blog.example", username: "writer" };
  const calls = setup(site, () => response({ id: 1 }));
  await signInToWordPress({ password: "abcd efgh" });
  assert.equal(calls[0].url, "https://blog.example/wp-json/wp/v2/users/me");
  assert.equal(calls[0].options.headers.Authorization, `Basic ${btoa("writer:abcdefgh")}`);
  assert.deepEqual(JSON.parse(await typora.secrets.get("auth:https://blog.example")), { username: "writer", password: "abcd efgh" });
  assert.deepEqual(await typora.storage.keys(), []);
  setup(site, () => response({ code: "incorrect_password", message: "The provided password is an invalid application password." }, 401));
  let stored = false;
  typora.secrets.set = async () => { stored = true; };
  await assert.rejects(signInToWordPress({ password: "wrong" }), /invalid application password/);
  assert.equal(stored, false);
  setup({ siteUrl: "http://blog.example", username: "writer" }, () => response({}));
  await assert.rejects(signInToWordPress({ password: "x" }), /HTTPS/);
});
test("Mataroa creates Markdown through the central API and reads a baseline", async () => {
  const calls = setup({ siteUrl: "https://me.mataroa.blog" }, (url, options) => response(options.method === "POST" ? { slug: "hello", url: "https://me.mataroa.blog/blog/hello/" } : { slug: "hello", title: "Hello", body: "World", published_at: "2026-10-26", url: "https://me.mataroa.blog/blog/hello/" }));
  const document = await mataroa({ operation: "prepare", source });
  assert.equal(document.title, "Hello");
  assert.equal(document.markdown, "World");
  const saved = await mataroa({ operation: "create", document });
  assert.equal(saved.state, "published");
  assert.equal(calls[0].url, "https://mataroa.blog/api/posts/");
  assert.equal(JSON.parse(calls[0].options.body).body, "World");
  assert.match(calls[0].options.headers.Authorization, /^Bearer /);
});
test("Mataroa maps drafts, missing articles and authentication failures separately", async () => {
  setup({ siteUrl: "https://me.mataroa.blog" }, () => response({}, 404));
  const document = await mataroa({ operation: "prepare", source });
  assert.equal(await mataroa({ operation: "get", document, remote: { id: "gone" } }), null);
  setup({ siteUrl: "https://me.mataroa.blog" }, () => response({}, 401));
  await assert.rejects(mataroa({ operation: "get", document, remote: { id: "gone" } }), /401/);
});
test("Mataroa gets comments by article slug", async () => {
  const calls = setup({ siteUrl: "https://me.mataroa.blog" }, () => response({ comment_list: [] }));
  const document = await mataroa({ operation: "prepare", source });
  await mataroa({ operation: "comments", document, remote: { id: "hello" } });
  assert.equal(calls[0].url, "https://mataroa.blog/api/posts/hello/comments/");
});
test("Write.as trades the password for a token that every blog on the site shares", async () => {
  const calls = setup({ siteUrl: "https://write.as", username: " writer ", collection: "first" }, (url, options) => response(url.endsWith("/auth/login") ? { data: { access_token: "user-token" } } : { data: { id: "opaque", slug: "hello" } }));
  await signInWithPassword({ password: "secret" });
  assert.equal(calls[0].url, "https://write.as/api/auth/login");
  assert.deepEqual(JSON.parse(calls[0].options.body), { alias: "writer", pass: "secret" });
  assert.equal(calls[0].options.headers.Authorization, undefined);
  typora.settings.get = key => ({ siteUrl: "https://write.as", collection: "second" })[key];
  await writeas({ operation: "get", document: { account: "https://write.as/collection/second" }, remote: { id: "opaque" } });
  assert.equal(calls[1].options.headers.Authorization, "Token user-token");
});
test("Write.as reports sign-in failures in its own words and keeps no token", async () => {
  setup({ siteUrl: "https://write.as", username: "writer" }, () => response({ code: 401, error_msg: "Incorrect password." }, 401));
  await assert.rejects(signInWithPassword({ password: "wrong" }), /Incorrect password/);
  assert.equal(await typora.secrets.get("publish-auth:https://write.as"), "test-token"); // setup's default, nothing stored
  setup({ siteUrl: "https://write.as" }, () => response({}));
  await assert.rejects(signInWithPassword({ password: "secret" }), /user name/);
});
test("Write.as tells a blog title from an alias, and an expired token from a missing post", async () => {
  setup({ siteUrl: "https://write.as", collection: "My Blog" }, () => response({}));
  await assert.rejects(writeas({ operation: "prepare", source }), /"My Blog" is not a blog alias/);
  setup({ siteUrl: "https://write.as", collection: "writer" }, () => response({}, 401));
  const document = await writeas({ operation: "prepare", source });
  await assert.rejects(writeas({ operation: "get", document, remote: { id: "opaque" } }), /password/);
  setup({ siteUrl: "https://write.as", collection: "writer" }, () => response({}, 404));
  assert.equal(await writeas({ operation: "get", document, remote: { id: "opaque" } }), null);
});
test("Write.as publishes to the configured collection and keeps views out of revisions", async () => {
  let views = 1;
  const post = () => ({ id: "opaque", slug: "hello", title: "Hello", body: "World", created: "today", views: views++ });
  const calls = setup({ siteUrl: "https://write.as", collection: "writer" }, () => response({ data: post() }));
  const document = await writeas({ operation: "prepare", source });
  const saved = await writeas({ operation: "create", document });
  assert.equal(calls[0].url, "https://write.as/api/collections/writer/posts");
  assert.equal(saved.state, "unknown");
  assert.equal((await writeas({ operation: "get", document, remote: saved })).revision, saved.revision);
  assert.equal((await writeas({ operation: "metrics", document, remote: saved })).supported, true);
  await assert.rejects(writeas({ operation: "create", document, draft: true }), /drafts/);
});
test("platforms without upload APIs reject local media during preparation", async () => {
  setup({ siteUrl: "https://me.mataroa.blog" }, () => { throw Error("unexpected network"); });
  await assert.rejects(mataroa({ operation: "prepare", source: { ...source, markdown: "![cat](cat.png)" } }), /no image upload API/);
});
test("Pika creates a draft and separates its edit URL from live URLs", async () => {
  const id = "https://pika.page/dashboard/posts/123/edit";
  const calls = setup({ siteUrl: "https://me.pika.page" }, (url, options) => options.method === "POST" ? response({}, 201, { location: id }) : response({ properties: { name: ["Hello"], content: ["World"], "post-status": ["draft"] } }));
  const document = await pika({ operation: "prepare", source });
  const saved = await pika({ operation: "create", document, draft: true });
  assert.equal(saved.editUrl, id);
  assert.equal(saved.url, undefined);
  assert.deepEqual(JSON.parse(calls[0].options.body).properties["post-status"], ["draft"]);
});
test("Pika uploads bytes as multipart and uses uploaded URLs in content", async () => {
  const id = "https://me.pika.page/posts/cat";
  const calls = setup({ siteUrl: "https://me.pika.page" }, (url, options) => {
    if (url.endsWith("/media")) return response({}, 201, { location: "https://pika.page/media/cat.png" });
    if (options.method === "POST") return response({}, 201, { location: id });
    return response({ properties: { name: ["cat"], content: ["![cat](https://pika.page/media/cat.png)"], "post-status": ["published"] } });
  });
  const document = await pika({ operation: "prepare", source: { ...source, markdown: "![cat](cat.png)" } });
  await pika({ operation: "create", document });
  assert.match(calls[0].options.headers["Content-Type"], /^multipart\/form-data; boundary=/);
  assert.ok(calls[0].options.body instanceof Uint8Array);
  assert.match(JSON.parse(calls[1].options.body).properties.content[0], /https:\/\/pika.page\/media\/cat.png/);
});
test("Pika updates via replace and preserves the remote state without --draft", async () => {
  const calls = setup({ siteUrl: "https://me.pika.page" }, () => response({ properties: { name: ["Hello"], content: ["World"], "post-status": ["published"] } }));
  const document = await pika({ operation: "prepare", source });
  await pika({ operation: "update", document, remote: { id: "https://me.pika.page/posts/hello" } });
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.action, "update");
  assert.equal(body.replace["post-status"], undefined);
});
test("WordPress reads legacy bindings and creates through the common adapter", async () => {
  const calls = setup({ siteUrl: "https://blog.example", status: "draft", removeTitleHeading: true }, (url, options) => response({ id: 12, status: "draft", modified_gmt: "today", title: { raw: "Hello" }, content: { raw: "World" }, excerpt: { raw: "" }, link: "https://blog.example/hello" }));
  const document = await wordpress({ operation: "prepare", source });
  const saved = await wordpress({ operation: "create", document });
  assert.equal(saved.id, "12");
  assert.equal(saved.url, undefined);
  assert.match(saved.editUrl, /wp-admin/);
  assert.match(calls[0].url, /wp-json\/wp\/v2\/posts$/);
  assert.equal(JSON.parse(calls[0].options.body).status, "draft");
});
test("store exposes independent Export and Publish tags", () => {
  assert.ok(TAGS.includes("Export"));
  assert.ok(TAGS.includes("Publish"));
  assert.ok(!TAGS.includes("Export / Share"));
});

test("Pika rewrites parsed images while preserving code examples and prose", () => {
  const text = 'cat.png `![cat](cat.png)`\n\n![cat](cat.png)\n\n```md\n![cat](cat.png)\n```';
  const rewritten = replaceImageSources(text, new Map([["cat.png", "https://cdn.example/cat.png"]]));
  assert.ok(rewritten.startsWith('cat.png `![cat](cat.png)`'));
  assert.match(rewritten, /!\[cat\]\(<https:\/\/cdn.example\/cat.png>\)/);
  assert.ok(rewritten.endsWith('```md\n![cat](cat.png)\n```'));
});
