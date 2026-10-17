// AI Front Matter — `main`. Asks the model set up in Settings ▸ Intelligence
// for a title, a description, tags and a slug, and writes them into the
// document's front matter. Tags reuse the ones the open folder's notes use.

import { getKey, splitFrontMatter, updateFrontMatter } from "./fm.js";
import {
  SYSTEM_PROMPT,
  buildPrompt,
  canonicalTags,
  documentExcerpt,
  extractJson,
  mergeTags,
  noteTags,
  normalizeReply,
  rankTags,
  slugify,
} from "./meta.js";

const NOTE_FILE = /\.(md|markdown|mdown|mkd|mkdn)$/i;
const MAX_NOTES = 300;
const MAX_VOCABULARY = 200;
const VOCABULARY_TTL_MS = 10 * 60_000;

/** Folder → { at, tags } for this window's session. */
const vocabularies = new Map();
let busy = false;

const asString = (value) => (typeof value === "string" ? value : "");
const asList = (value) => (Array.isArray(value) ? value : typeof value === "string" && value ? value.split(",").map((t) => t.trim()).filter(Boolean) : []);

async function folderVocabulary(documentPath, keys) {
  const [root] = await typora.workspace.folders();
  if (!root) return [];
  const key = `${root}\u0000${keys.join(",")}`;
  const cached = vocabularies.get(key);
  if (cached && Date.now() - cached.at < VOCABULARY_TTL_MS) return cached.tags;
  const files = (await typora.workspace.listFiles()).filter((path) => NOTE_FILE.test(path) && path !== documentPath).slice(0, MAX_NOTES);
  const lists = [];
  for (let i = 0; i < files.length; i += 8) {
    const texts = await Promise.all(files.slice(i, i + 8).map((path) => typora.workspace.readFile(path).catch(() => "")));
    for (const text of texts) lists.push(noteTags(text, keys));
  }
  const tags = rankTags(lists)
    .slice(0, MAX_VOCABULARY)
    .map((entry) => entry.tag);
  vocabularies.set(key, { at: Date.now(), tags });
  return tags;
}

/** What `mode` asks for, given what the front matter already has. */
function wanted(mode, settings, fm) {
  const has = (key) => {
    const value = getKey(fm, key);
    return Array.isArray(value) ? value.length > 0 : !!value;
  };
  if (mode === "title") return { titles: true };
  if (mode === "tags") return { tags: true };
  const replace = settings.overwrite === true;
  return {
    titles: settings.includeTitle !== false && (replace || !has("title")),
    description: settings.includeDescription !== false && (replace || !has(settings.descriptionKey)),
    tags: settings.includeTags !== false,
    slug: settings.includeSlug !== false && (replace || !has("slug")),
  };
}

async function run(mode) {
  if (busy) {
    await typora.ui.toast("Still waiting for the model.");
    return;
  }
  busy = true;
  try {
    await generate(mode);
  } catch (error) {
    await typora.ui.toast(error?.message ?? String(error));
  } finally {
    busy = false;
  }
}

async function generate(mode) {
  const settings = {
    descriptionKey: "description",
    tagsKey: "tags",
    listStyle: "flow",
    maxTags: 5,
    maxChars: 12000,
    language: "",
    ...typora.settings.get(),
  };
  const maxTags = Math.max(1, Math.min(15, Math.round(Number(settings.maxTags) || 5)));
  const info = await typora.document.info();
  if (!info) {
    await typora.ui.toast("Open a document first.");
    return;
  }
  const status = await typora.ai.status();
  if (!status.ready) {
    await typora.ui.toast(status.problem || "Set up a model in Settings ▸ Intelligence.");
    return;
  }

  const markdown = await typora.editor.getMarkdown();
  const fm = splitFrontMatter(markdown);
  const want = wanted(mode, settings, fm);
  if (!want.titles && !want.description && !want.tags && !want.slug) {
    await typora.ui.toast("The front matter already has these. Turn on “Replace existing values” in the options to write new ones.");
    return;
  }
  if (!documentExcerpt(fm.body, 100).trim()) {
    await typora.ui.toast("Write something first: the document is empty.");
    return;
  }
  const currentTitle = asString(getKey(fm, "title"));
  const tagKeys = [...new Set([settings.tagsKey, "tags"])];
  const vocabulary = want.tags && settings.folderTags !== false ? await folderVocabulary(info.path, tagKeys).catch(() => []) : [];

  await typora.ui.toast(`Asking ${status.model || "the model"}…`);
  const reply = await typora.ai.complete({
    system: SYSTEM_PROMPT,
    prompt: buildPrompt({
      body: documentExcerpt(fm.body, Math.max(1000, Number(settings.maxChars) || 12000)),
      frontMatter: fm.lines.join("\n"),
      vocabulary,
      want,
      maxTags,
      language: asString(settings.language).trim(),
      currentTitle,
      titleCount: mode === "title" ? 5 : 3,
    }),
    maxTokens: 1000,
  });
  const data = normalizeReply(extractJson(reply), { maxTags });

  const changes = {};
  let titleSlug = "";
  if (want.titles) {
    if (!data.titles.length) throw new Error("The model suggested no title.");
    const items = data.titles.map((item) => ({ label: item.title, description: item.slug, value: item }));
    if (currentTitle) items.push({ label: `Keep “${currentTitle}”`, value: "keep" });
    const picked = await typora.ui.quickPick(items, { placeholder: "Pick a title" });
    if (!picked) return;
    if (picked === "keep") titleSlug = slugify(currentTitle) || data.titles[0].slug;
    else {
      changes.title = picked.title;
      titleSlug = picked.slug;
    }
  }
  if (want.description && data.description) changes[settings.descriptionKey] = data.description;
  if (want.tags && data.tags.length) {
    const existing = asList(getKey(fm, settings.tagsKey));
    const suggested = canonicalTags(data.tags, [...existing, ...vocabulary]);
    const tags = mode === "generate" && settings.overwrite === true ? suggested : mergeTags(existing, suggested);
    if (tags.join("\n") !== existing.join("\n")) changes[settings.tagsKey] = tags;
  }
  if (want.slug) {
    const slug = titleSlug || data.slug || slugify(currentTitle);
    if (slug) changes.slug = slug;
  }

  if (!Object.keys(changes).length) {
    await typora.ui.toast(mode === "tags" ? "No new tags to add." : "Nothing to change.");
    return;
  }
  // The document may have changed while the model was writing: apply to what is there now.
  const latest = await typora.editor.getMarkdown();
  const next = updateFrontMatter(latest, changes, { listStyle: settings.listStyle });
  if (next === latest) {
    await typora.ui.toast("Nothing to change.");
    return;
  }
  await typora.editor.replaceDocument(next);
  await typora.ui.toast(`Updated ${Object.keys(changes).join(", ")}.`);
}

export function activate(ctx) {
  ctx.subscriptions.push(
    typora.commands.register("generate", () => run("generate")),
    typora.commands.register("tags", () => run("tags")),
    typora.commands.register("title", () => run("title")),
  );
}
