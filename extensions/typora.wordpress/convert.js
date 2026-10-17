// WordPress — Markdown to block-editor markup and to classic HTML. No
// Typora APIs here, so it also runs under plain Node.
import { Marked } from "./vendor/marked.esm.js";

const escapeHtml = (text) =>
  String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ── Front matter ───────────────────────────────────────────────────────

/** `{ yaml, data, body, eol }`; `yaml` is null without front matter. */
export function parseFrontMatter(markdown) {
  const text = markdown.replace(/^﻿/, "");
  const eol = /\r\n/.test(text.slice(0, text.indexOf("\n") + 1)) ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);
  if (lines[0] !== "---") return { yaml: null, data: {}, body: text, eol };
  const end = lines.findIndex((line, i) => i > 0 && (line === "---" || line === "..."));
  if (end < 0) return { yaml: null, data: {}, body: text, eol };
  const yaml = lines.slice(1, end);
  return { yaml: yaml.join("\n"), data: readYaml(yaml), body: lines.slice(end + 1).join("\n"), eol };
}

function scalar(value) {
  const v = value.trim();
  if (/^".*"$/.test(v)) {
    try {
      return JSON.parse(v);
    } catch {
      return v.slice(1, -1);
    }
  }
  if (/^'.*'$/.test(v)) return v.slice(1, -1).replace(/''/g, "'");
  if (/^-?\d+$/.test(v)) return Number(v);
  if (v === "true" || v === "false") return v === "true";
  return v.replace(/\s+#.*$/, "");
}

/** Top-level `key: value`, `key: [a, b]` and `key:` + `- item` lists. */
function readYaml(lines) {
  const data = {};
  let listKey = null;
  for (const line of lines) {
    const item = /^\s+-\s+(.*)$|^-\s+(.*)$/.exec(line);
    if (item && listKey) {
      data[listKey].push(scalar(item[1] ?? item[2]));
      continue;
    }
    const m = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const [, key, value] = m;
    listKey = null;
    if (!value.trim()) {
      data[key] = [];
      listKey = key;
    } else if (/^\[.*\]$/.test(value.trim())) {
      data[key] = value.trim().slice(1, -1).split(",").map(scalar).filter((v) => v !== "");
    } else data[key] = scalar(value);
  }
  return data;
}

function yamlValue(value) {
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  const text = String(value);
  return /^[\w./-][^:#'"\n]*$/.test(text) && !/^(true|false|null|~|-?\d)/.test(text) ? text : JSON.stringify(text);
}

/**
 * Set top-level front matter keys, keeping every other line (and the
 * document's line endings). Adds front matter when there is none.
 */
export function setFrontMatterKeys(markdown, entries) {
  const bom = markdown.startsWith("﻿") ? "﻿" : "";
  const { yaml, body, eol } = parseFrontMatter(markdown);
  const lines = yaml === null ? [] : yaml.split("\n");
  for (const [key, value] of Object.entries(entries)) {
    const line = `${key}: ${yamlValue(value)}`;
    const at = lines.findIndex((l) => new RegExp(`^${key}\\s*:`).test(l));
    if (at < 0) {
      lines.push(line);
      continue;
    }
    // A value continued on indented lines (a list, a folded string) goes too.
    let next = at + 1;
    while (next < lines.length && /^(\s+\S|-\s)/.test(lines[next])) next++;
    lines.splice(at, next - at, line);
  }
  const head = ["---", ...lines, "---"].join(eol) + eol;
  const rest = body.replace(/\r?\n/g, eol);
  if (yaml !== null) return bom + head + rest;
  return bom + head + (/^\s*\n/.test(rest) || !rest ? "" : eol) + rest;
}

// ── Markdown ───────────────────────────────────────────────────────────

function createMarked(footnotes) {
  const marked = new Marked({ gfm: true });
  marked.use({
    extensions: [
      {
        name: "mathBlock",
        level: "block",
        start: (src) => src.match(/^\$\$/m)?.index,
        tokenizer(src) {
          const m = /^\$\$[ \t]*\n([\s\S]*?)\n\$\$[ \t]*(?:\n+|$)/.exec(src);
          if (m) return { type: "mathBlock", raw: m[0], text: m[1] };
        },
        renderer: (token) => `<p>$$\n${escapeHtml(token.text)}\n$$</p>\n`,
      },
      {
        name: "footnoteDef",
        level: "block",
        start: (src) => src.match(/^\[\^[^\]\s]+\]:/m)?.index,
        tokenizer(src) {
          const m = /^\[\^([^\]\s]+)\]:[ \t]*([^\n]*(?:\n(?: {2,}|\t)[^\n]*)*)(?:\n+|$)/.exec(src);
          if (!m) return;
          const token = { type: "footnoteDef", raw: m[0], id: m[1], tokens: [] };
          this.lexer.inline(m[2].replace(/\n\s+/g, " "), token.tokens);
          return token;
        },
        renderer: () => "",
      },
      {
        name: "footnoteRef",
        level: "inline",
        start: (src) => src.indexOf("[^"),
        tokenizer(src) {
          const m = /^\[\^([^\]\s]+)\]/.exec(src);
          if (m) return { type: "footnoteRef", raw: m[0], id: m[1] };
        },
        renderer(token) {
          if (!footnotes.order.includes(token.id)) footnotes.order.push(token.id);
          const n = footnotes.order.indexOf(token.id) + 1;
          return `<sup><a href="#fn-${escapeHtml(token.id)}" id="fnref-${escapeHtml(token.id)}">${n}</a></sup>`;
        },
      },
      inlineRule("mathInline", "$", /^\$(?!\s)((?:\\.|[^$\\\n])+?)(?<!\s)\$(?!\d)/, (t) => escapeHtml(t.raw)),
      inlineRule("mark", "==", /^==(?=\S)([\s\S]*?\S)==(?!=)/, (t, parser) => `<mark>${parser.parseInline(t.tokens)}</mark>`, true),
      inlineRule("sub", "~", /^~((?:\\.|[^~\s\\])+)~(?!~)/, (t, parser) => `<sub>${parser.parseInline(t.tokens)}</sub>`, true),
      inlineRule("sup", "^", /^\^((?:\\.|[^^\s\\])+)\^/, (t, parser) => `<sup>${parser.parseInline(t.tokens)}</sup>`, true),
    ],
    renderer: {
      checkbox: ({ checked }) => (checked ? "☑" : "☐"),
    },
  });
  return marked;
}

function inlineRule(name, marker, pattern, render, nested = false) {
  return {
    name,
    level: "inline",
    start: (src) => src.indexOf(marker),
    tokenizer(src) {
      const m = pattern.exec(src);
      if (!m) return;
      const token = { type: name, raw: m[0], text: m[1], tokens: [] };
      if (nested) this.lexer.inlineTokens(m[1], token.tokens);
      return token;
    },
    renderer(token) {
      return render(token, this.parser);
    },
  };
}

/** Whether an image source is a file on this computer: a path or a file: URL. */
export const isLocalImage = (src) => !!src && !/^\/\//.test(src) && (/^file:/i.test(src) || !/^[a-z][a-z0-9+.-]*:/i.test(src) || /^[a-z]:[\\/]/i.test(src));

const HTML_IMG_SRC = /(<img\b[^>]*?\ssrc\s*=\s*)(["'])(.*?)\2/gi;

/**
 * Sources of images stored on this computer, as written in the document
 * (Markdown images and `<img src>`), once each.
 */
export function localImages(markdown) {
  const { body } = parseFrontMatter(markdown);
  const marked = createMarked({ order: [] });
  const found = new Set();
  marked.walkTokens(marked.lexer(body), (token) => {
    if (token.type === "image" && isLocalImage(token.href)) found.add(token.href);
    if (token.type === "html") for (const m of token.text.matchAll(HTML_IMG_SRC)) if (isLocalImage(m[3])) found.add(m[3]);
  });
  return [...found];
}

/** The first heading's text when the document starts with a `# H1`. */
export function leadingTitle(markdown) {
  const { body } = parseFrontMatter(markdown);
  const first = createMarked({ order: [] }).lexer(body).find((t) => t.type !== "space");
  return first?.type === "heading" && first.depth === 1 ? first.text.replace(/[*_`~=]/g, "").trim() : null;
}

/** Point images at their uploaded copies: `images` maps a source as written to `{ url, id }`. */
function useUploads(marked, tokens, images) {
  if (!images?.size) return;
  marked.walkTokens(tokens, (token) => {
    if (token.type === "image" && images.has(token.href)) {
      const media = images.get(token.href);
      token.href = media.url;
      token.mediaId = media.id;
    } else if (token.type === "html") {
      const swap = (text) => text.replace(HTML_IMG_SRC, (all, head, quote, src) => (images.has(src) ? `${head}${quote}${escapeHtml(images.get(src).url)}${quote}` : all));
      token.text = swap(token.text);
      token.raw = swap(token.raw);
    }
  });
}

function prepare(markdown, options) {
  const footnotes = { order: [] };
  const marked = createMarked(footnotes);
  const tokens = marked.lexer(parseFrontMatter(markdown).body);
  useUploads(marked, tokens, options.images);
  if (options.dropTitle) {
    const first = tokens.findIndex((t) => t.type !== "space");
    if (first >= 0 && tokens[first].type === "heading" && tokens[first].depth === 1) tokens.splice(first, 1);
  }
  const defs = new Map();
  for (const token of tokens) if (token.type === "footnoteDef") defs.set(token.id, token);
  return { marked, tokens: tokens.filter((t) => t.type !== "footnoteDef"), footnotes, defs };
}

function footnoteList(parser, footnotes, defs) {
  const items = footnotes.order
    .filter((id) => defs.has(id))
    .map((id) => `<li id="fn-${escapeHtml(id)}">${parser.parseInline(defs.get(id).tokens)} <a href="#fnref-${escapeHtml(id)}">↩</a></li>`);
  return items.length ? `<ol class="footnotes">${items.join("")}</ol>` : "";
}

// ── Block editor ───────────────────────────────────────────────────────

const comment = (name, attrs) => `<!-- wp:${name}${attrs && Object.keys(attrs).length ? ` ${JSON.stringify(attrs)}` : ""} -->`;
const block = (name, attrs, html) => `${comment(name, attrs)}\n${html}\n<!-- /wp:${name} -->`;

/** What the core code block saves: `&`, `<`, `[` and isolated URLs escaped. */
function codeText(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/\[/g, "&#91;")
    .replace(/^(\s*https?:)\/\/([^\s<>"]+\s*)$/gm, "$1&#47;&#47;$2");
}

const inline = (parser, tokens) => parser.parseInline(tokens).replace(/\n(?!$)/g, " ");

function onlyImage(token) {
  const parts = token.tokens.filter((t) => !(t.type === "text" && !t.text.trim()));
  return parts.length === 1 && parts[0].type === "image" ? parts[0] : null;
}

function imageBlock(image) {
  const title = image.title ? ` title="${escapeHtml(image.title)}"` : "";
  const src = `src="${escapeHtml(image.href)}" alt="${escapeHtml(image.text)}"`;
  // A Media Library image: the block knows its attachment.
  if (image.mediaId)
    return block(
      "image",
      { id: image.mediaId, sizeSlug: "full", linkDestination: "none" },
      `<figure class="wp-block-image size-full"><img ${src} class="wp-image-${image.mediaId}"${title}/></figure>`,
    );
  return block("image", null, `<figure class="wp-block-image"><img ${src}${title}/></figure>`);
}

function listBlock(parser, list) {
  const attrs = {};
  if (list.ordered) attrs.ordered = true;
  if (list.ordered && list.start !== 1 && list.start !== "") attrs.start = list.start;
  const tag = list.ordered ? "ol" : "ul";
  const start = attrs.start !== undefined ? ` start="${attrs.start}"` : "";
  const items = list.items.map((item) => {
    let html = item.task ? (item.checked ? "☑ " : "☐ ") : "";
    const nested = [];
    for (const child of item.tokens) {
      if (child.type === "list") nested.push(listBlock(parser, child));
      else if (child.type === "text" || child.type === "paragraph") html += (html && !item.task ? "<br>" : "") + inline(parser, child.tokens ?? [child]);
      else if (child.type !== "space") html += parser.parse([child]).trim();
    }
    return block("list-item", null, `<li>${html}${nested.join("")}</li>`);
  });
  return block("list", attrs, `<${tag} class="wp-block-list"${start}>${items.join("")}</${tag}>`);
}

function tableBlock(parser, table) {
  const cell = (tag, c, i) => {
    const align = table.align[i];
    const attrs = align ? ` class="has-text-align-${align}" data-align="${align}"` : "";
    return `<${tag}${attrs}>${inline(parser, c.tokens)}</${tag}>`;
  };
  const head = `<thead><tr>${table.header.map((c, i) => cell("th", c, i)).join("")}</tr></thead>`;
  const rows = table.rows.map((row) => `<tr>${row.map((c, i) => cell("td", c, i)).join("")}</tr>`).join("");
  return block("table", null, `<figure class="wp-block-table"><table class="has-fixed-layout">${head}<tbody>${rows}</tbody></table></figure>`);
}

function toBlock(parser, token) {
  switch (token.type) {
    case "space":
    case "def":
      return "";
    case "heading": {
      const attrs = token.depth === 2 ? null : { level: token.depth };
      return block("heading", attrs, `<h${token.depth} class="wp-block-heading">${inline(parser, token.tokens)}</h${token.depth}>`);
    }
    case "paragraph": {
      const image = onlyImage(token);
      return image ? imageBlock(image) : block("paragraph", null, `<p>${inline(parser, token.tokens)}</p>`);
    }
    case "text":
      return block("paragraph", null, `<p>${inline(parser, token.tokens ?? [token])}</p>`);
    case "list":
      return listBlock(parser, token);
    case "blockquote":
      return block("quote", null, `<blockquote class="wp-block-quote">${blocks(parser, token.tokens)}</blockquote>`);
    case "code":
      return block("code", null, `<pre class="wp-block-code"><code>${codeText(token.text)}</code></pre>`);
    case "table":
      return tableBlock(parser, token);
    case "hr":
      return block("separator", null, `<hr class="wp-block-separator has-alpha-channel-opacity"/>`);
    case "html":
      return token.text.trim() ? block("html", null, token.text.trim()) : "";
    default:
      // Math and anything an extension adds: its HTML as is.
      return block("html", null, parser.parse([token]).trim());
  }
}

function blocks(parser, tokens) {
  return tokens.map((t) => toBlock(parser, t)).filter(Boolean).join("\n\n");
}

/**
 * Block-editor markup: paste it into a post, or send it as `content`.
 * `options.images` (source → `{ url, id }`) swaps in uploaded images.
 */
export function toBlocks(markdown, options = {}) {
  const { marked, tokens, footnotes, defs } = prepare(markdown, options);
  const parser = new marked.Parser(marked.defaults);
  const out = blocks(parser, tokens);
  const notes = footnoteList(parser, footnotes, defs);
  if (!notes) return out;
  return `${out}\n\n${toBlock(parser, { type: "hr" })}\n\n${block("html", null, notes)}`;
}

// ── Classic editor ─────────────────────────────────────────────────────

/**
 * Plain HTML, nothing Typora-specific. Without `paragraphs`, top-level
 * paragraphs are bare text separated by blank lines: the classic editor
 * adds `<p>` itself.
 */
export function toClassicHtml(markdown, options = {}) {
  const { marked, tokens, footnotes, defs } = prepare(markdown, options);
  const parser = new marked.Parser(marked.defaults);
  const parts = tokens
    .filter((t) => t.type !== "space" && t.type !== "def")
    .map((token) => {
      if (token.type !== "paragraph") return parser.parse([token]).trim();
      const text = inline(parser, token.tokens);
      return options.paragraphs ? `<p>${text}</p>` : text;
    });
  const notes = footnoteList(parser, footnotes, defs);
  if (notes) parts.push("<hr>", notes);
  return parts.join("\n\n");
}
