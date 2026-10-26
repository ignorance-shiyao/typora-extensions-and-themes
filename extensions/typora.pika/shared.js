// Shared protocol helpers, vendored in each independently installable extension.
import { parseFrontMatter, leadingTitle, localImages, isLocalImage } from "./convert.js";
export async function hash(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), b => b.toString(16).padStart(2, "0")).join("");
}
export function baseUrl(value) {
  let url;
  try { url = new URL(String(value)); } catch { throw new Error("Configure your blog HTTPS Site URL in the extension options first."); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error("Enter an HTTPS site URL without credentials, query or fragment.");
  return url.href.replace(/\/+$/, "");
}
export async function token(account, label) {
  const value = await typora.storage.get(`publish-auth:${account}`);
  if (!value) throw new Error(`Sign in to ${label} using its extension command first.`);
  return value;
}
export async function request(url, authorization, method = "GET", body, headers = {}) {
  const response = await typora.net.fetch(url, { method, headers: { Authorization: authorization, ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...headers }, body: typeof body === "object" && !(body instanceof Uint8Array) ? JSON.stringify(body) : body });
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}: ${await response.text()}`);
    error.status = response.status;
    throw error;
  }
  return response;
}
export async function json(url, auth, method, body) { return (await request(url, auth, method, body)).json(); }
export async function prepare(source, account, media = false, settings = {}) {
  const parsed = parseFrontMatter(source.markdown);
  const metadata = parsed.data;
  const supported = new Set(["title", "slug", "excerpt", "description", "date", "status", "tags", "categories", "category", "cover", "image", "featured_image", "publish_id", "wordpress_id", "wordpress_url"]);
  const lists = new Set(["tags", "categories", "category"]);
  const seen = new Set();
  for (const line of (parsed.yaml || "").split("\n")) {
    const match = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
    if (!match || !supported.has(match[1])) continue;
    const [_, key, value] = match;
    if (seen.has(key)) throw new Error(`Duplicate publication metadata: ${key}`);
    seen.add(key);
    if (/^[>|&*!{]/.test(value) || (value.startsWith('"') && !value.endsWith('"')) || (value.startsWith("'") && !value.endsWith("'")) || (Array.isArray(metadata[key]) && !lists.has(key))) throw new Error(`Unsupported publication metadata for ${key}; use a single-line scalar or a simple tags/categories list.`);
  }
  const heading = leadingTitle(source.markdown);
  const title = String(metadata.title || heading || source.path.replace(/^.*[/\\]/, "").replace(/\.[^.]+$/, ""));
  const markdown = heading && (!metadata.title || metadata.title === heading) ? parsed.body.replace(/^(?:\s*\n)*# [^\n]*(?:\n|$)/, "").replace(/^\n+/, "") : parsed.body;
  const sources = [...new Set([...localImages(source.markdown), ...[metadata.cover, metadata.image, metadata.featured_image].filter(v => typeof v === "string" && isLocalImage(v))])];
  if (sources.length && !media) throw new Error("This adapter has no image upload API. Host local images first and use HTTPS URLs.");
  const assets = [];
  for (const src of sources) {
    const image = await typora.document.readImage(src);
    assets.push({ src, name: image.name, type: image.type, bytes: image.bytes, hash: await hash(image.bytes) });
  }
  return { account, documentId: metadata.publish_id ? String(metadata.publish_id) : undefined, title, markdown, metadata, assets,
    fingerprint: await hash(JSON.stringify({ markdown: source.markdown, settings, assets: assets.map(({src, hash}) => ({src, hash})) })) };
}
export async function signIn(account, label) {
  const value = (await typora.ui.input({ prompt: `${label} API token (stored in extension private storage)` }))?.trim();
  if (value) await typora.storage.set(`publish-auth:${account}`, value);
}
export async function signOut() {
  for (const key of await typora.storage.keys()) if (key.startsWith("publish-auth:")) await typora.storage.remove(key);
}
export function register(ctx, id, handler, account, label) {
  ctx.subscriptions.push(typora.publish.registerAdapter(id, handler),
    typora.commands.register("signIn", () => signIn(account(), label)),
    typora.commands.register("signOut", signOut),
    typora.commands.register("publish", async () => {
      if (!await typora.ui.confirm(`Publish this document to ${label}?`)) return;
      try { const result = await typora.publish.current(id); await typora.ui.toast(result.error || `${result.action || result.sync}: ${result.remote?.url || result.remote?.editUrl || ""}`); }
      catch (error) { await typora.ui.toast(error.message); }
    }),
    typora.commands.register("status", async () => {
      try { await typora.ui.toast(JSON.stringify(await typora.publish.current(id, { status: true, refresh: true, metrics: true, comments: true }))); }
      catch (error) { await typora.ui.toast(error.message); }
    }));
}
