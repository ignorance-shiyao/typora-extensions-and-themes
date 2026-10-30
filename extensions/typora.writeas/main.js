import { baseUrl, credential, json, prepare, hash, register } from "./shared.js";
const base = () => baseUrl(typora.settings.get("siteUrl"));
const collection = () => {
  const alias = String(typora.settings.get("collection") || "").trim();
  if (!alias) throw new Error("Set your Write.as / WriteFreely blog alias first.");
  if (!/^[a-zA-Z0-9-]+$/.test(alias)) throw new Error(`"${alias}" is not a blog alias. Use the name in your blog's address, such as my-blog in write.as/my-blog, not its title.`);
  return alias;
};
const account = () => `${base()}/collection/${collection()}`;
// One token per site: it belongs to the user, who may have several blogs there.
const tokenKey = () => `publish-auth:${base()}`;
async function auth() {
  const value = await credential(tokenKey());
  if (!value) throw new Error("Enter your Write.as user name and password in the extension options first.");
  return `Token ${value}`;
}
async function api(path, method, body) {
  try { return (await json(`${base()}/api${path}`, await auth(), method, body)).data; }
  catch (error) {
    if (error.status === 401) error.message = "Write.as rejected the saved sign-in. Enter your password in the extension options again.";
    throw error;
  }
}
// Write.as has no page that issues access tokens: logging in is the only way to get one.
export async function signInWithPassword({ password }) {
  const alias = String(typora.settings.get("username") || "").trim();
  if (!alias) throw new Error("Enter your user name.");
  const response = await typora.net.fetch(`${base()}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ alias, pass: password }) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error_msg || `Sign-in failed: HTTP ${response.status}`);
  await typora.secrets.set(tokenKey(), result.data.access_token);
}
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
export function activate(ctx) {
  register(ctx, "writeas", adapter, base, "Write.as");
  ctx.subscriptions.push(typora.commands.register("signInWithPassword", signInWithPassword));
}
