import { prepare, hash } from "./shared.js";
import { toBlocks, isLocalImage, leadingTitle } from "./convert.js";
import { siteBase, createClient, termIds, list, postDate, uploadImages, featuredSource, authKey } from "./main.js";
async function client() {
  const base = siteBase();
  if (!base || !base.startsWith("https://")) throw new Error("Set an HTTPS WordPress site first.");
  const auth = await typora.storage.get(authKey(base));
  const username = String(typora.settings.get("username") || "");
  if (!auth || (username && username !== auth.username)) throw new Error("Sign in using Publish to WordPress first.");
  return createClient(base, auth);
}
async function remote(post) {
  const state = ({ publish: "published", future: "scheduled" })[post.status] || post.status;
  return { id: String(post.id), state,
    ...(post.status === "publish" ? { url: post.link } : { editUrl: `${siteBase()}/wp-admin/post.php?post=${post.id}&action=edit` }),
    revision: await hash(JSON.stringify([post.modified_gmt, post.status, post.title?.raw, post.content?.raw, post.excerpt?.raw, post.tags, post.categories, post.featured_media])) };
}
async function get(ref) {
  try { return await remote(await (await client()).request("GET", `/posts/${encodeURIComponent(ref.id)}`, { query: { context: "edit" } })); }
  catch (error) { if (error.status === 404 || error.status === 410) return null; throw error; }
}
export async function adapter(request) {
  const { operation, document, remote: ref } = request;
  if (operation === "prepare") {
    const base = siteBase();
    const settings = typora.settings.get();
    const auth = await typora.storage.get(authKey(base));
    const account = `${base}/user/${encodeURIComponent(auth?.username || settings.username || "")}`;
    const prepared = await prepare(request.source, account, true, settings);
    prepared.sourceMarkdown = request.source.markdown;
    if (prepared.assets.length && settings.uploadImages === false) throw new Error("Local images require Upload local images.");
    // Adopt existing V1 front matter only when it belongs to this exact WordPress site.
    if (prepared.metadata.wordpress_id && prepared.metadata.wordpress_url) {
      const url = new URL(prepared.metadata.wordpress_url);
      if (url.origin === new URL(base).origin && url.pathname.startsWith(new URL(base).pathname.replace(/\/$/, "") + "/")) {
        prepared.adoptRemote = { id: String(prepared.metadata.wordpress_id), state: "unknown", revision: "" };
      }
    }
    return prepared;
  }
  const currentAuth = await typora.storage.get(authKey(siteBase()));
  if (document.account !== `${siteBase()}/user/${encodeURIComponent(currentAuth?.username || typora.settings.get("username") || "")}`) throw new Error("WordPress account changed during publication.");
  if (operation === "get") return get(ref);
  const api = await client();
  if (operation === "comments") {
    const items = await api.request("GET", "/comments", { query: { post: ref.id, context: "edit", per_page: "100" } });
    return { supported: true, items, limit: 100, truncated: items.length === 100 };
  }
  if (operation !== "create" && operation !== "update") throw new Error("Unsupported WordPress operation.");
  const meta = document.metadata;
  const notes = [];
  const uploads = await uploadImages(api, siteBase(), document.assets.map(a => a.src), notes);
  if (uploads.size !== document.assets.length) throw new Error(`Not all local images were uploaded: ${notes.join("; ")}`);
  const heading = leadingTitle(document.sourceMarkdown);
  const post = { title: document.title, content: toBlocks(document.sourceMarkdown, { images: uploads, dropTitle: typora.settings.get("removeTitleHeading") !== false && heading !== null && (!meta.title || meta.title === heading) }) };
  if (request.draft) post.status = "draft";
  else if (["draft", "pending", "private", "publish"].includes(meta.status)) post.status = meta.status;
  else if (!ref) post.status = typora.settings.get("status") || "draft";
  if (meta.slug) post.slug = String(meta.slug);
  if (meta.excerpt || meta.description) post.excerpt = String(meta.excerpt || meta.description);
  const date = postDate(meta.date);
  if (date) post.date = date;
  if (Object.hasOwn(meta, "tags")) post.tags = await termIds(api, "tags", list(meta.tags), notes);
  if (Object.hasOwn(meta, "categories") || Object.hasOwn(meta, "category")) post.categories = await termIds(api, "categories", list(meta.categories ?? meta.category), notes);
  const featured = featuredSource(meta);
  if (featured && isLocalImage(featured)) post.featured_media = uploads.get(featured).id;
  if (notes.some(n => n.includes("wasn't added"))) throw new Error(notes.join("; "));
  const saved = await api.request("POST", ref ? `/posts/${encodeURIComponent(ref.id)}` : "/posts", { body: post });
  const result = await get({ id: String(saved.id) });
  if (!result) throw new Error("Saved WordPress article could not be read back.");
  return result;
}
