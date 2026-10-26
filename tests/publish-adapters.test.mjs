import { replaceImageSources } from "../extensions/typora.pika/convert.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { adapter as mataroa } from "../extensions/typora.mataroa/main.js";
import { adapter as writeas } from "../extensions/typora.writeas/main.js";
import { adapter as pika } from "../extensions/typora.pika/main.js";
import { adapter as wordpress } from "../extensions/typora.wordpress/adapter.js";
import { TAGS } from "../scripts/lib.mjs";
const response = (data, status = 200, headers) => new Response(JSON.stringify(data), { status, headers });
function setup(settings, fetch) {
  const calls = [];
  const storage = new Map();
  globalThis.typora = {
    settings: { get: key => key ? settings[key] : settings },
    storage: { get: async key => storage.get(key) ?? (key.startsWith("auth:") ? { username: "writer", password: "pass" } : key.startsWith("publish-auth:") ? "test-token" : undefined), set: async (key, value) => storage.set(key, value) },
    net: { fetch: async (url, options) => { calls.push({ url, options }); return fetch(url, options); } },
    document: { readImage: async () => ({ name: "cat.png", type: "image/png", bytes: new Uint8Array([1, 2, 3]) }) },
    ui: { toast: async () => {} },
  };
  return calls;
}
const source = { path: "/posts/a.md", markdown: "# Hello\n\nWorld" };
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
