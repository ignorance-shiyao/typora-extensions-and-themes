import { baseUrl, token, json, request as fetchApi, prepare, hash, register } from "./shared.js";
const account = () => baseUrl(typora.settings.get("siteUrl"));
const auth = async () => `Bearer ${await token(account(), "Mataroa")}`;
async function remote(post) {
  return { id: post.slug, state: post.published_at ? "published" : "draft", url: post.published_at ? post.url : undefined,
    revision: await hash(JSON.stringify([post.slug, post.title, post.body, post.published_at])) };
}
async function get(id) {
  try { return await remote(await json(`https://mataroa.blog/api/posts/${encodeURIComponent(id)}/`, await auth())); }
  catch (error) { if (error.status === 404) return null; throw error; }
}
export async function adapter(request) {
  const { operation, document, remote: ref, draft } = request;
  if (operation === "prepare") return prepare(request.source, account(), false);
  if (document.account !== account()) throw new Error("Mataroa site changed during publishing.");
  if (operation === "get") return get(ref.id);
  if (operation === "comments") return json(`https://mataroa.blog/api/posts/${encodeURIComponent(ref.id)}/comments/`, await auth());
  if (operation !== "create" && operation !== "update") throw new Error("Unsupported Mataroa operation.");
  const body = { title: document.title, body: document.markdown };
  if (draft) body.published_at = "";
  else if (!ref) body.published_at = document.metadata.date || new Date().toISOString().slice(0, 10);
  if (!draft && document.metadata.date) body.published_at = String(document.metadata.date).slice(0, 10);
  if (ref && document.metadata.slug) body.slug = String(document.metadata.slug);
  const saved = await json(`https://mataroa.blog/api/posts/${ref ? `${encodeURIComponent(ref.id)}/` : ""}`, await auth(), ref ? "PATCH" : "POST", body);
  const result = await get(saved.slug);
  if (!result) throw new Error("Saved Mataroa article could not be read back.");
  return result;
}
export const checkKey = key => fetchApi("https://mataroa.blog/api/comments/pending/", `Bearer ${key}`);
export function activate(ctx) { register(ctx, "mataroa", adapter, account, "Mataroa", checkKey); }
