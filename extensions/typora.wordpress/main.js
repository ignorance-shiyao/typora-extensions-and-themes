// WordPress — `main`: copy the document as block-editor markup or classic
// HTML, and publish it as a post through the WordPress REST API.
import { isLocalImage, leadingTitle, localImages, parseFrontMatter, setFrontMatterKeys, toBlocks, toClassicHtml } from "./convert.js";

const STATUS_WORDS = { draft: "Draft saved", pending: "Submitted for review", private: "Saved as private", publish: "Published", future: "Scheduled" };

export function activate(ctx) {
  ctx.subscriptions.push(
    typora.commands.register("copyBlocks", () => copy("blocks").catch(report)),
    typora.commands.register("copyClassic", () => copy("classic").catch(report)),
    typora.commands.register("publish", () => publish().catch(report)),
    typora.commands.register("signOut", signOut),
  );
}

const report = (error) => typora.ui.toast(error.message);

async function copy(kind) {
  const markdown = await typora.editor.getMarkdown();
  const options = { dropTitle: titleOf(markdown, null).drop, paragraphs: typora.settings.get("classicParagraphs") };
  if (kind === "blocks") {
    await typora.clipboard.writeText(toBlocks(markdown, options));
    await typora.ui.toast("Copied for the block editor. Paste it into a post.");
  } else {
    await typora.clipboard.writeText(toClassicHtml(markdown, options));
    await typora.ui.toast("Copied as HTML. Paste it into the Text tab of the classic editor.");
  }
}

/**
 * The post title: front matter `title`, else a leading `# H1`, else the file
 * name. That H1 is left out of the content when it is the title.
 */
function titleOf(markdown, info) {
  const given = String(parseFrontMatter(markdown).data.title ?? "").trim();
  const heading = leadingTitle(markdown);
  const drop = !!typora.settings.get("removeTitleHeading") && heading !== null && (!given || heading === given);
  return { title: given || heading || (info?.name ?? "Untitled").replace(/\.[^.]+$/, ""), drop };
}

// ── Site and sign-in ───────────────────────────────────────────────────

function siteBase() {
  const raw = String(typora.settings.get("siteUrl") ?? "").trim();
  if (!raw) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
  } catch {
    return null;
  }
}

const authKey = (base) => `auth:${base}`;

async function signIn(base, host) {
  const saved = await typora.storage.get(authKey(base));
  const wanted = String(typora.settings.get("username") ?? "").trim();
  if (saved && (!wanted || saved.username === wanted)) return saved;
  const username =
    wanted ||
    (await typora.ui.input({ prompt: `Your WordPress user name on ${host}`, value: saved?.username ?? "", placeholder: "User name" }))?.trim();
  if (!username) return null;
  const password = (
    await typora.ui.input({
      prompt: `Application Password for ${username} on ${host} (Users ▸ Profile ▸ Application Passwords)`,
      placeholder: "xxxx xxxx xxxx xxxx xxxx xxxx",
    })
  )?.trim();
  if (!password) return null;
  const auth = { username, password };
  await typora.storage.set(authKey(base), auth);
  return auth;
}

async function signOut() {
  const keys = (await typora.storage.keys()).filter((key) => key.startsWith("auth:"));
  for (const key of keys) await typora.storage.remove(key);
  await typora.ui.toast(keys.length ? "Signed out. The Application Password was removed." : "You weren't signed in.");
}

// ── REST API ───────────────────────────────────────────────────────────

class WordPressError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function createClient(base, auth) {
  const host = new URL(base).host;
  const authorization = `Basic ${btoa(String.fromCharCode(...new TextEncoder().encode(`${auth.username}:${auth.password.replace(/\s+/g, "")}`)))}`;
  // Sites without pretty permalinks only answer at ?rest_route=.
  let plain = false;
  const url = (path, query = {}) => {
    const params = new URLSearchParams(query);
    const rest = params.toString();
    if (plain) return `${base}/?rest_route=${encodeURIComponent(`/wp/v2${path}`)}${rest ? `&${rest}` : ""}`;
    return `${base}/wp-json/wp/v2${path}${rest ? `?${rest}` : ""}`;
  };
  /** `body` is sent as JSON; `bytes` (with `headers`) as they are, for uploads. */
  async function request(method, path, { query, body, bytes, headers } = {}, retry = true) {
    let response;
    try {
      response = await typora.net.fetch(url(path, query), {
        method,
        headers: { Authorization: authorization, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
        body: bytes ?? (body ? JSON.stringify(body) : undefined),
        timeoutMs: bytes ? 120_000 : 30_000,
      });
    } catch (error) {
      throw new WordPressError(`Couldn't reach ${host}: ${error.message}`, 0);
    }
    const text = await response.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      // HTML: a 404 page, a login wall, a firewall.
    }
    if (data === null && retry && !plain && response.status === 404) {
      plain = true;
      return request(method, path, { query, body, bytes, headers }, false);
    }
    if (response.ok && data !== null) return data;
    if (data === null) throw new WordPressError(`The WordPress REST API isn't reachable at ${base}/wp-json (HTTP ${response.status}).`, response.status, "rest_no_route");
    if (data.code === "rest_no_route") throw new WordPressError(`The WordPress REST API isn't reachable at ${base}/wp-json.`, response.status, data.code);
    throw new WordPressError(stripTags(data.message) || `${host} answered HTTP ${response.status}.`, response.status, data.code);
  }
  return { request, host };
}

const stripTags = (text) => String(text ?? "").replace(/<[^>]+>/g, "").trim();

/** Names (or a comma list) → term ids, creating missing tags (and categories, when allowed). */
async function termIds(client, kind, names, notes) {
  const ids = [];
  for (const name of names) {
    const found = await client.request("GET", `/${kind}`, { query: { search: name, per_page: "100" } });
    const match = found.find((t) => stripTags(t.name).toLowerCase() === name.toLowerCase() || t.slug === name.toLowerCase());
    if (match) {
      ids.push(match.id);
      continue;
    }
    try {
      ids.push((await client.request("POST", `/${kind}`, { body: { name } })).id);
    } catch (error) {
      if (error.code === "term_exists") continue;
      notes.push(`${kind === "tags" ? "Tag" : "Category"} “${name}” wasn't added: ${error.message}`);
    }
  }
  return ids;
}

const list = (value) =>
  (Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : []).map((v) => String(v).trim()).filter(Boolean);

function postDate(value) {
  const text = String(value ?? "").trim();
  const m = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{1,2}:\d{2})(:\d{2})?)?$/.exec(text);
  if (!m) return null;
  return `${m[1]}T${(m[2] ?? "00:00").padStart(5, "0")}${m[3] ?? ":00"}`;
}

// ── Images ─────────────────────────────────────────────────────────────

const mediaKey = (base) => `media:${base}`;

async function sha256(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** `Content-Disposition` for an upload, with an RFC 5987 name when it isn't ASCII. */
function disposition(name) {
  const ascii = name.replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "") || "image";
  return /^[\x20-\x7e]*$/.test(name) && !/["\\]/.test(name)
    ? `attachment; filename="${name}"`
    : `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`;
}

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Upload the document's local images (and a local featured image) to the
 * Media Library. Returns source → `{ url, id }`; images uploaded before (same
 * bytes, same site) are not sent again. Throws a 401 so publishing stops.
 */
async function uploadImages(client, base, sources, notes) {
  const uploads = new Map();
  if (!sources.length) return uploads;
  const cache = (await typora.storage.get(mediaKey(base))) ?? {};
  const failed = [];
  let sent = 0;
  /** WordPress's message when this user may not upload (403), and how many that left out. */
  let roleRefused = null;
  let skipped = 0;
  /** Hash → the image and every source showing it, so equal files go up once. */
  const pending = new Map();
  for (const src of sources) {
    try {
      const image = await typora.document.readImage(src);
      const hash = await sha256(image.bytes);
      if (cache[hash]) uploads.set(src, cache[hash]);
      else if (pending.has(hash)) pending.get(hash).sources.push(src);
      else pending.set(hash, { image, sources: [src] });
    } catch (error) {
      failed.push(`${src} — ${error.message}`);
    }
  }
  let index = 0;
  for (const [hash, { image, sources: shown }] of pending) {
    if (roleRefused) {
      skipped++;
      continue;
    }
    if (index === 0 || (pending.size >= 6 && index === Math.floor(pending.size / 2)))
      await typora.ui.toast(`Uploading ${index + 1} of ${plural(pending.size, "image")}…`);
    index++;
    try {
      const media = await client.request("POST", "/media", {
        bytes: image.bytes,
        headers: { "Content-Type": image.type || "application/octet-stream", "Content-Disposition": disposition(image.name) },
      });
      const entry = { id: media.id, url: media.source_url };
      for (const src of shown) uploads.set(src, entry);
      cache[hash] = entry;
      sent++;
      await typora.storage.set(mediaKey(base), cache);
    } catch (error) {
      if (error.status === 401) throw error;
      if (error.status === 403) {
        roleRefused = error.message;
        skipped++;
      } else failed.push(`${image.name} — ${error.message}`);
    }
  }
  if (roleRefused) notes.push(`Your role can't upload media, so ${plural(skipped, "image")} stayed local (${roleRefused})`);
  if (failed.length)
    notes.push(`${plural(failed.length, "image")} couldn't be uploaded: ${failed.slice(0, 3).join("; ")}${failed.length > 3 ? "; …" : ""}`);
  else if (sent) notes.push(`${plural(sent, "image")} uploaded`);
  return uploads;
}

/** The front matter's featured image source, if any. */
const featuredSource = (meta) => [meta.featured_image, meta.cover, meta.image].find((v) => typeof v === "string" && v.trim())?.trim() ?? null;

// ── Publish ────────────────────────────────────────────────────────────

async function publish() {
  const base = siteBase();
  if (!base) {
    await typora.ui.toast("Set your site in Settings ▸ Extensions ▸ WordPress ▸ Options first.");
    return;
  }
  const host = new URL(base).host;
  const markdown = await typora.editor.getMarkdown();
  const info = await typora.document.info();
  const settings = typora.settings.get();
  const meta = parseFrontMatter(markdown).data;
  const { title, drop: dropTitle } = titleOf(markdown, info);

  const auth = await signIn(base, host);
  if (!auth) return;
  const client = createClient(base, auth);

  // An earlier publish to this site: update that post.
  let existing = null;
  const sameSite = meta.wordpress_url && safeHost(meta.wordpress_url) === host;
  if (Number.isInteger(meta.wordpress_id) && sameSite) {
    try {
      existing = await client.request("GET", `/posts/${meta.wordpress_id}`, { query: { context: "edit" } });
    } catch (error) {
      if (error.status === 401 || error.status === 403) return refused(base, error);
      if (error.status !== 404 && error.status !== 410) throw error;
      if (!(await typora.ui.confirm(`Post ${meta.wordpress_id} is gone from ${host}. Publish this as a new post?`))) return;
    }
  }

  const status = ["draft", "pending", "private", "publish"].includes(meta.status) ? meta.status : existing ? null : settings.status;
  const live = (existing?.status === "publish" && status !== "draft") || (!existing && status === "publish");
  if (live && !(await typora.ui.confirm(existing ? `“${title}” is live on ${host}. Update it?` : `Publish “${title}” publicly on ${host}?`))) return;

  const notes = [];
  // Local images: to the Media Library, unless turned off or Typora can't read them.
  const local = localImages(markdown);
  const featured = featuredSource(meta);
  const canUpload = typeof typora.document.readImage === "function";
  let uploads = new Map();
  if (settings.uploadImages !== false && canUpload) {
    const sources = [...new Set([...local, ...(featured && isLocalImage(featured) ? [featured] : [])])];
    try {
      uploads = await uploadImages(client, base, sources, notes);
    } catch (error) {
      if (error.status === 401) return refused(base, error);
      throw error;
    }
  } else if (local.length) {
    const why = canUpload ? "upload them to the site first, or turn on “Upload local images”" : "this version of Typora can't upload them";
    notes.push(`${plural(local.length, "local image")} ${local.length === 1 ? "wasn't" : "weren't"} uploaded; ${why}.`);
  }
  const post = { title, content: toBlocks(markdown, { dropTitle, images: uploads }) };
  if (featured) {
    if (uploads.has(featured)) post.featured_media = uploads.get(featured).id;
    else if (!isLocalImage(featured)) notes.push("The featured image must be a local image (or already in the Media Library); a web address can't be set.");
  }
  if (status) post.status = status;
  if (meta.slug) post.slug = String(meta.slug);
  const excerpt = meta.excerpt ?? meta.description;
  if (excerpt) post.excerpt = String(excerpt);
  const date = postDate(meta.date);
  if (date) post.date = date;
  try {
    const tags = list(meta.tags);
    if (tags.length) post.tags = await termIds(client, "tags", tags, notes);
    const categories = list(meta.categories ?? meta.category);
    if (categories.length) post.categories = await termIds(client, "categories", categories, notes);
  } catch (error) {
    if (error.status === 401 || error.status === 403) return refused(base, error);
    throw error;
  }

  let saved;
  try {
    saved = await client.request("POST", existing ? `/posts/${existing.id}` : "/posts", { body: post });
  } catch (error) {
    if (error.status === 401 || error.status === 403) return refused(base, error);
    throw error;
  }

  await remember(saved);
  const done = existing && saved.status === "publish" ? "Updated" : (STATUS_WORDS[saved.status] ?? "Saved");
  await typora.ui.toast([`${done}: ${saved.link}`, ...notes].join(" — "));
}

const safeHost = (url) => {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
};

/** 401: the password is wrong or revoked, so forget it. 403: this user may not do that. */
async function refused(base, error) {
  const host = new URL(base).host;
  if (error.status !== 401) return typora.ui.toast(`${host} refused: ${error.message}`);
  await typora.storage.remove(authKey(base));
  await typora.ui.toast(`${host} didn't accept the user name or Application Password. Publish again to enter it.`);
}

/** Note the post in the front matter, so the next publish updates it. */
async function remember(saved) {
  const markdown = await typora.editor.getMarkdown();
  const meta = parseFrontMatter(markdown).data;
  if (meta.wordpress_id === saved.id && meta.wordpress_url === saved.link) return;
  try {
    await typora.editor.replaceDocument(setFrontMatterKeys(markdown, { wordpress_id: saved.id, wordpress_url: saved.link }));
  } catch {
    await typora.ui.toast(`Add “wordpress_id: ${saved.id}” to the front matter so the next publish updates this post.`);
  }
}
