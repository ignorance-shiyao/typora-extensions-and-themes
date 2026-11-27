const FENCE = /^\s*(`{3,}|~{3,})(.*)$/;
const DIVIDER = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;
const REFERENCE = /^\s{0,3}\[[^\]]+\]:/;
const HTML_TAG = /^\s*<([a-z][\w-]*)(?:\s|\/?>)/i;
const VOID_TAG = /^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i;
const LIST_PREFIX = /^\s*(?:[-+*]|\d{1,9}[.)])[ \t]+/;
const INLINE_CODE = /(?<ticks>`+)(?!`)[^]*?(?<!`)\k<ticks>(?!`)/g;

function insideQuote(line) {
  return line.replace(/^(?:[ \t]*>[ \t]?)+/, "");
}

export function protectedLines(lines, { includeTables = true } = {}) {
  const protectedRows = new Set();
  let closes = null;
  let table = false;
  let indentedCode = false;

  for (const [index, original] of lines.entries()) {
    const line = insideQuote(original);
    const previous = insideQuote(lines[index - 1] ?? "");
    if (closes) {
      protectedRows.add(index);
      if (closes(line)) closes = null;
      continue;
    }

    const fence = FENCE.exec(line.replace(LIST_PREFIX, ""));
    const html = HTML_TAG.exec(line);
    if (index === 0 && /^\uFEFF?---[ \t]*$/.test(line)) {
      closes = (row) => /^(?:---|\.\.\.)[ \t]*$/.test(row);
    } else if (fence) {
      const marker = fence[1];
      closes = (row) => {
        const candidate = FENCE.exec(row);
        return candidate && candidate[1][0] === marker[0] && candidate[1].length >= marker.length && !candidate[2].trim();
      };
    } else if (/^\s*\$\$\s*$/.test(line)) {
      closes = (row) => /^\s*\$\$\s*$/.test(row);
    } else if (/^\s*<!--/.test(line) && !line.includes("-->")) {
      closes = (row) => row.includes("-->");
    } else if (html && !VOID_TAG.test(html[1]) && !line.trimEnd().endsWith("/>") && !new RegExp(`</${html[1]}\\s*>`, "i").test(line)) {
      const ending = new RegExp(`</${html[1]}\\s*>`, "i");
      closes = (row) => ending.test(row) || (!/^(?:pre|script|style|textarea)$/i.test(html[1]) && !row.trim());
    }
    if (includeTables && DIVIDER.test(line) && line.includes("|") && previous.includes("|") && !protectedRows.has(index - 1)) {
      table = true;
      protectedRows.add(index - 1);
    }
    table = table && line.includes("|") && Boolean(line.trim());

    const indented = /^(?: {4}|\t)/.test(line);
    indentedCode = indented && (indentedCode || !previous.trim());
    if (closes || table || indentedCode || REFERENCE.test(line) || /^\s*</.test(line)) {
      protectedRows.add(index);
    }
  }

  // Code spans can cross soft line breaks within a paragraph.
  for (let start = 0; start < lines.length;) {
    if (protectedRows.has(start) || !lines[start].trim() || !lines[start].includes("`")) {
      start++;
      continue;
    }
    let end = start + 1;
    while (end < lines.length && !protectedRows.has(end) && lines[end].trim()) end++;
    const paragraph = lines.slice(start, end).join("\n");
    let row = start;
    let offset = 0;
    for (const match of paragraph.matchAll(INLINE_CODE)) {
      while (paragraph.indexOf("\n", offset) < match.index && row < end - 1) {
        offset = paragraph.indexOf("\n", offset) + 1;
        row++;
      }
      if (match[0].includes("\n")) {
        protectedRows.add(row);
        for (let i = 0; i < match[0].length; i++) {
          if (match[0][i] === "\n") protectedRows.add(++row);
        }
        offset = match.index + match[0].length;
      }
    }
    start = end;
  }
  return protectedRows;
}
