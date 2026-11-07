/** Markmap accepts HTML labels. Only escaped, plain outline text goes in. */
export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

/** Use the original document-block API; an outline snapshot is optional. */
export function documentOutline({ outline, blocks }) {
  if (Array.isArray(outline)) return outline;
  if (!Array.isArray(blocks)) return null;
  return blocks
    .filter((block) => block.type === "heading" && block.depth === 0)
    .map((block) => ({
      id: block.id,
      level: block.attrs?.level ?? 1,
      text: headingLabel(block.text),
    }));
}

/** Plain labels for hosts that send raw block text, never rendered HTML. */
function headingLabel(source) {
  const literals = [];
  const literal = (value) => `\u0000${literals.push(value) - 1}\u0000`;
  return String(source ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/^ {0,3}#{1,6}(?:[ \t]+|$)/, "")
    .replace(/\n {0,3}(?:=+|-+)[ \t]*$/, "")
    .replace(/[ \t]+#+[ \t]*$/, "")
    .replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~])/g, (_, text) => literal(text))
    .replace(/(`+)([\s\S]*?)\1/g, (_, ticks, text) => literal(text))
    .replace(/<!--[^]*?-->/g, "")
    .replace(/!\[[^\]]*\](?:\([^)]*\)|\[[^\]]*\])?/g, "")
    .replace(/\[\^[^\]]*\]/g, "")
    .replace(/\[([^\]]*)\](?:\([^)]*\)|\[[^\]]*\])/g, "$1")
    .replace(/<((?:https?:\/\/|mailto:)[^<>]+)>/g, "$1")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/(\*\*|__|~~|==)(.*?)\1/g, "$2")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/(?<!\w)_([^_]+)_(?!\w)/g, "$1")
    .replace(/\u0000(\d+)\u0000/g, (_, index) => literals[Number(index)])
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp|#\d+|#x[\da-f]+);/gi, (entity) => {
      if (entity[1] !== "#") return ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'", "&nbsp;": "\u00a0" })[entity.toLowerCase()];
      const hex = entity[2].toLowerCase() === "x";
      const code = Number.parseInt(entity.slice(hex ? 3 : 2, -1), hex ? 16 : 10);
      return code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    })
    .trim();
}

/** Same nearest-lower-level parenting as the Outline tab, including skipped levels. */
export function outlineTree(outline, folds = new Map()) {
  const roots = [];
  const path = [];
  for (const { id, level, text } of outline) {
    const label = text || "Untitled";
    const node = {
      content: `<button type="button" class="heading" data-block-id="${escapeHtml(id)}">${escapeHtml(label)}</button>`,
      payload: { blockId: id, label, fold: folds.get(id) ? 1 : 0 },
      children: [],
    };
    while (path.length && path[path.length - 1].level >= level) path.pop();
    if (path.length) path[path.length - 1].node.children.push(node);
    else roots.push(node);
    path.push({ level, node });
  }
  if (!roots.length) return null;
  if (roots.length === 1) return roots[0];
  return {
    content: '<span class="root-label">Outline</span>',
    payload: { label: "Outline", fold: folds.get(null) ? 1 : 0 },
    children: roots,
  };
}

export function collectFolds(root, folds = new Map()) {
  if (!root) return folds;
  folds.set(root.payload.blockId ?? null, !!root.payload.fold);
  for (const child of root.children ?? []) collectFolds(child, folds);
  return folds;
}

export function markmapTree(outline) {
  const root = outlineTree(outline);
  const convert = (node) => ({
    id: node.payload.blockId ?? "typora-outline-root", type: "heading",
    content: [{ type: "text", value: node.payload.label }], notes: [],
    data: { blockId: node.payload.blockId, label: node.payload.label },
    children: node.children.map(convert),
  });
  return root ? convert(root) : null;
}
