// Pure helpers: tag vocabularies, the prompt, reading the model's reply.

import { getKey, splitFrontMatter } from "./fm.js";

/** Tags of one note: a list, or a comma (or space) separated string. */
export function noteTags(markdown, keys) {
  const fm = splitFrontMatter(markdown);
  if (!fm.exists) return [];
  for (const key of keys) {
    const value = getKey(fm, key);
    if (value === undefined || value === "") continue;
    const list = Array.isArray(value) ? value : value.includes(",") ? value.split(",") : value.split(/\s+/);
    return list.map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean);
  }
  return [];
}

/** Tags by how many notes use them, most used first. Spelling is taken from the first note that uses a tag. */
export function rankTags(tagLists) {
  const counts = new Map();
  for (const tags of tagLists) {
    for (const tag of new Set(tags.map((t) => t.toLowerCase()))) {
      const entry = counts.get(tag);
      if (entry) entry.count++;
      else counts.set(tag, { tag: tags.find((t) => t.toLowerCase() === tag), count: 1 });
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** The first JSON object in a reply that may wrap it in a code fence or prose. */
export function extractJson(reply) {
  const text = String(reply ?? "");
  const fenced = /```(?:json|JSON)?\s*\n([\s\S]*?)```/.exec(text);
  const candidates = fenced ? [fenced[1], text] : [text];
  for (const candidate of candidates) {
    for (let start = candidate.indexOf("{"); start !== -1; start = candidate.indexOf("{", start + 1)) {
      const end = matchingBrace(candidate, start);
      if (end === -1) break;
      try {
        const value = JSON.parse(candidate.slice(start, end + 1));
        if (value && typeof value === "object" && !Array.isArray(value)) return value;
      } catch {
        // Try the next "{".
      }
    }
  }
  throw new Error("The model's reply wasn't the JSON that was asked for. Try again, or use a stronger model.");
}

function matchingBrace(text, start) {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === "\\") i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return i;
  }
  return -1;
}

/** Lowercase ASCII words joined by hyphens, at most 80 characters. */
export function slugify(text) {
  const slug = String(text ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[æÆ]/g, "ae")
    .replace(/[øØ]/g, "o")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length <= 80) return slug;
  const cut = slug.slice(0, 81);
  return (cut.lastIndexOf("-") > 40 ? cut.slice(0, cut.lastIndexOf("-")) : cut.slice(0, 80)).replace(/-+$/, "");
}

const str = (value) => (typeof value === "string" ? value.trim() : "");

/** The reply, checked and cleaned: `{ titles: [{ title, slug }], slug, description, tags }`. */
export function normalizeReply(raw, { maxTags }) {
  const titles = (Array.isArray(raw.titles) ? raw.titles : [])
    .map((item) => (typeof item === "string" ? { title: item, slug: "" } : { title: str(item?.title), slug: str(item?.slug) }))
    .map(({ title, slug }) => ({ title: title.replace(/\s+/g, " "), slug: slugify(slug) || slugify(title) }))
    .filter((item) => item.title);
  const seen = new Set();
  const tags = (Array.isArray(raw.tags) ? raw.tags : typeof raw.tags === "string" ? raw.tags.split(",") : [])
    .map((tag) => str(String(tag)).replace(/^#/, ""))
    .filter((tag) => tag && !seen.has(tag.toLowerCase()) && seen.add(tag.toLowerCase()))
    .slice(0, maxTags);
  let description = str(raw.description).replace(/\s+/g, " ");
  if (description.length > 200) description = description.slice(0, 199).replace(/\s+\S*$/, "") + "…";
  return { titles, slug: slugify(str(raw.slug)), description, tags };
}

/** Tags spelled the way the vocabulary spells them (case-insensitive match), without duplicates. */
export function canonicalTags(tags, vocabulary) {
  const known = new Map(vocabulary.map((tag) => [tag.toLowerCase(), tag]));
  return mergeTags([], tags.map((tag) => known.get(tag.toLowerCase()) ?? tag));
}

/** Existing first, then new ones (case-insensitive). */
export function mergeTags(existing, added) {
  const seen = new Set(existing.map((t) => t.toLowerCase()));
  return [...existing, ...added.filter((t) => !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase()))];
}

export const SYSTEM_PROMPT =
  "You write front matter metadata for Markdown notes and blog posts. Reply with one JSON object and nothing else: no prose, no code fence.";

/**
 * The request. `want` lists what to write: titles, description, tags, slug.
 * The body is cut to `maxChars` (from the start).
 */
export function buildPrompt({ body, frontMatter, vocabulary, want, maxTags, language, currentTitle, titleCount }) {
  const shape = {};
  if (want.titles) shape.titles = [{ title: "…", slug: "…" }];
  if (want.slug && !want.titles) shape.slug = "…";
  if (want.description) shape.description = "…";
  if (want.tags) shape.tags = ["…"];
  const rules = [];
  const lang = language ? `in ${language}` : "in the language the document is written in";
  if (want.titles)
    rules.push(
      `"titles": ${titleCount} different title candidates ${lang}, best first: specific, at most about 70 characters, no trailing period, no quotes or Markdown. Each has a "slug" for its URL.`,
    );
  if (want.slug && !want.titles)
    rules.push(`"slug": a URL slug for the title ${currentTitle ? JSON.stringify(currentTitle) : "the document should have"}.`);
  if (want.titles || want.slug)
    rules.push("Slugs: lowercase ASCII words joined by hyphens, 3 to 6 words; translate or transliterate non-Latin titles into English words.");
  if (want.description)
    rules.push(`"description": one sentence ${lang} that tells a reader what the document gives them, at most 155 characters, no Markdown.`);
  if (want.tags) {
    rules.push(`"tags": 1 to ${maxTags} tags for the topics the document is about, most relevant first.`);
    if (vocabulary.length)
      rules.push(
        "Prefer tags from the existing tag list, spelled exactly as listed. Add a new tag only for a main topic none of them covers, and write it in the same style as the list (case, separators, language).",
      );
    else rules.push("New tags are short, lowercase, words joined by hyphens.");
  }
  const parts = [
    `Write front matter for the document below. Reply with JSON shaped like ${JSON.stringify(shape)}.`,
    rules.map((rule) => `- ${rule}`).join("\n"),
  ];
  if (want.tags && vocabulary.length) parts.push(`Existing tags in this folder, most used first:\n${vocabulary.join(", ")}`);
  if (frontMatter.trim()) parts.push(`Current front matter:\n${frontMatter}`);
  parts.push(`Document:\n<document>\n${body}\n</document>`);
  return parts.join("\n\n");
}

/** The document without front matter, cut at a line break near `maxChars`. */
export function documentExcerpt(body, maxChars) {
  const text = body.trim();
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const at = cut.lastIndexOf("\n");
  return `${at > maxChars * 0.8 ? cut.slice(0, at) : cut}\n[…]`;
}
