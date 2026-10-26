import { baseUrl, token, json, prepare, hash, register } from "./shared.js";
const base = () => baseUrl(typora.settings.get("siteUrl"));
const collection = () => {
  const alias = String(typora.settings.get("collection") || "").trim();
  if (!/^[a-zA-Z0-9-]+$/.test(alias)) throw new Error("Set your Write.as / WriteFreely blog alias first.");
  return alias;
};
const account = () => `${base()}/collection/${collection()}`;
const auth = async () => `Token ${await token(account(), "Write.as")}`;
async function api(path, method, body) { return (await json(`${base()}/api${path}`, await auth(), method, body)).data; }
async function remote(post) {
  // Collection publicity is distinct from article existence. Do not claim public visibility.
  return { id: post.id, state: "unknown", url: post.slug ? `${base()}/${collection()}/${encodeURIComponent(post.slug)}` : `${base()}/${post.id}`,
    revision: await hash(JSON.stringify([post.title, post.body, post.slug, post.created])) };
}
async function get(id) {
  try { return await remote(await api(`/posts/${encodeURIComponent(id)}`)); }
  catch (error) { if (error.status === 404) return null; throw error; }
}
export async function adapter(request) {
  const { operation, document, remote: ref } = request;
  if (operation === "prepare") return prepare(request.source, account(), false);
  if (document.account !== account()) throw new Error("Write.as account changed during publishing.");
  if (operation === "get") return get(ref.id);
  if (operation === "metrics") { const post = await api(`/posts/${encodeURIComponent(ref.id)}`); return { supported: typeof post.views === "number", views: post.views, fetchedAt: new Date().toISOString() }; }
  if (operation !== "create" && operation !== "update") throw new Error("Unsupported Write.as operation.");
  if (request.draft) throw new Error("This adapter does not support remote drafts.");
  const saved = await api(ref ? `/posts/${encodeURIComponent(ref.id)}` : `/collections/${encodeURIComponent(collection())}/posts`, "POST", { title: document.title, body: document.markdown });
  const result = await get(saved.id);
  if (!result) throw new Error("Saved Write.as article could not be read back.");
  return result;
}
export function activate(ctx) { register(ctx, "writeas", adapter, account, "Write.as"); }
