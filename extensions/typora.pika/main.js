import { replaceImageSources } from "./convert.js";
import { baseUrl, token, json, request as fetchApi, prepare, hash, register } from "./shared.js";
const endpoint = "https://pika.page/micropub";
const account = () => baseUrl(typora.settings.get("siteUrl"));
const auth = async () => `Bearer ${await token(account(), "Pika")}`;
function propertiesOf(data) { return data.properties || data; }
async function remote(id, data) {
  const p = propertiesOf(data);
  const state = p["post-status"]?.[0] || "unknown";
  const canonical = p.url?.[0] || id;
  return { id: canonical, state, ...(state === "published" ? { url: canonical } : { editUrl: canonical }),
    revision: await hash(JSON.stringify([p.content, p.name, p.category, p["post-status"], p.published])) };
}
async function get(id) {
  try { return await remote(id, await json(`${endpoint}?q=source&url=${encodeURIComponent(id)}`, await auth())); }
  catch (error) { if (error.status === 404) return null; throw error; }
}
async function images(document) {
  const uploads = new Map();
  for (const image of document.assets) {
    if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(image.type)) throw new Error(`Pika cannot upload ${image.type}.`);
    const key = `publish-media:${document.account}:${image.hash}`;
    let url = await typora.storage.get(key);
    if (!url) {
      const boundary = `typora-${crypto.randomUUID()}`;
      const name = image.name.replace(/["\r\n\\]/g, "_");
      const body = new Uint8Array(await new Blob([
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: ${image.type}\r\n\r\n`,
        image.bytes, `\r\n--${boundary}--\r\n`,
      ]).arrayBuffer());
      const response = await fetchApi(`${endpoint}/media`, await auth(), "POST", body, { "Content-Type": `multipart/form-data; boundary=${boundary}` });
      url = response.headers.get("location");
      if (!url || !/^https:\/\//.test(url)) throw new Error("Pika upload returned no HTTPS Location.");
      await typora.storage.set(key, url);
    }
    uploads.set(image.src, url);
  }
  return replaceImageSources(document.markdown, uploads);
}
export async function adapter(request) {
  const { operation, document, remote: ref } = request;
  if (operation === "prepare") {
    const prepared = await prepare(request.source, account(), true);
    if (prepared.assets.some(image => !["image/jpeg", "image/png", "image/gif", "image/webp"].includes(image.type))) throw new Error("Pika supports JPEG, PNG, GIF and WebP uploads only.");
    return prepared;
  }
  if (document.account !== account()) throw new Error("Pika site changed during publishing.");
  if (operation === "get") return get(ref.id);
  if (operation !== "create" && operation !== "update") throw new Error("Unsupported Pika operation.");
  const p = { name: [document.title], content: [await images(document)] };
  if (Array.isArray(document.metadata.tags)) p.category = document.metadata.tags.map(String);
  if (request.draft) p["post-status"] = ["draft"];
  else if (!ref) p["post-status"] = ["published"];
  const response = await fetchApi(endpoint, await auth(), "POST", ref ? { action: "update", url: ref.id, replace: p } : { type: ["h-entry"], properties: p });
  const id = response.headers.get("location") || ref?.id;
  if (!id) throw new Error("Pika returned no article Location.");
  if (ref) return remote(id, await response.json());
  const result = await get(id);
  if (!result) throw new Error("Saved Pika article could not be read back.");
  return result;
}
export function activate(ctx) { register(ctx, "pika", adapter, account, "Pika"); }
