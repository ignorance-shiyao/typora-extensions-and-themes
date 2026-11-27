import { protectedLines } from "./rules/protected-blocks.js";
import { formatProse } from "./rules/prose.js";

const HEADING = /^( {0,3})(#{1,6})(?!#)([^\r\n]*\S)[ \t]*$/;
const LIST = /^([ \t]*)([-+*]|\d{1,9}[.)])([ \t]+)(\S.*)$/;
const THEMATIC_BREAK = /^\s{0,3}([-*_])(?:[ \t]*\1){2,}\s*$/;

function indentWidth(whitespace) {
  let width = 0;
  for (const char of whitespace) width += char === "\t" ? 4 - width % 4 : 1;
  return width;
}

function listItem(match, levels, options) {
  const [, indent, marker, gap, content] = match;
  const width = indentWidth(indent);
  while (levels.at(-1)?.width > width) levels.pop();
  if (levels.at(-1)?.width !== width) levels.push({ width, number: 0, delimiter: "" });
  const level = levels.at(-1);
  const ordered = /^\d/.test(marker);
  const delimiter = ordered ? marker.at(-1) : "";
  if (level.delimiter !== delimiter) {
    level.number = 0;
    level.delimiter = delimiter;
  }
  const bullet = ordered
    ? (options.lintNumbering === false ? marker : `${++level.number}${delimiter}`)
    : (options.lintBullets === false ? marker : "-");
  const size = options.lintIndent === 4 ? 4 : options.lintIndent === 0 ? 0 : 2;
  const parent = levels.at(-2);
  const outputWidth = size && parent && levels[0].width === 0
    ? Math.max(parent.outputWidth + size, parent.outputContent)
    : width;
  const indentation = outputWidth === width ? indent : " ".repeat(outputWidth);
  level.outputWidth = outputWidth;
  level.inputContent = width + marker.length + indentWidth(gap);
  level.outputContent = outputWidth + bullet.length + indentWidth(gap);
  return indentation + bullet + gap + formatProse(content, options);
}

export function lintMarkdown(markdown, options = {}) {
  const pieces = markdown.split(/(\r\n|\n|\r)/);
  const rows = [];
  for (let index = 0; index < pieces.length; index += 2) {
    if (index === pieces.length - 1 && !pieces[index]) break;
    rows.push({ text: pieces[index], ending: pieces[index + 1] ?? "" });
  }
  const ending = rows.find((row) => row.ending)?.ending ?? "\n";
  const protectedRows = protectedLines(rows.map((row) => row.text));
  const result = [];
  const levels = [];
  let previousHeading = 0;
  let seenH1 = false;
  let afterHeading = false;

  for (const [index, row] of rows.entries()) {
    const hasBom = index === 0 && row.text.startsWith("\uFEFF");
    const text = hasBom ? row.text.slice(1) : row.text;
    const blank = !text.trim();
    const protectedRow = protectedRows.has(index);
    const heading = !protectedRow && options.lintHeadings !== false && HEADING.exec(text);
    if ((heading || afterHeading) && !blank && result.length && result.at(-1).text.trim()) {
      result.push({ text: "", ending });
    }
    afterHeading = Boolean(heading);
    if (protectedRow) {
      result.push({ ...row, protected: true });
      continue;
    }
    if (blank && options.lintBlankLines !== false && result.length && !result.at(-1).text.trim()) continue;

    let formatted = text;
    const item = !heading && !THEMATIC_BREAK.test(text) && LIST.exec(text);
    if (heading) {
      const [, indent, marker, title] = heading;
      let depth = marker.length;
      if (depth === 1 && seenH1) depth = 2;
      if (previousHeading) depth = Math.min(depth, previousHeading + 1);
      if (depth === 1) seenH1 = true;
      previousHeading = depth;
      formatted = indent + "#".repeat(depth) + " " + formatProse(title.trim(), options);
      levels.length = 0;
    } else if (item) {
      formatted = listItem(item, levels, options);
    } else if (!blank) {
      const prefix = /^(?:[ \t]*>[ \t]?)*[ \t]*/.exec(text)[0];
      const width = indentWidth(prefix);
      while (levels.length && width < levels.at(-1).inputContent) levels.pop();
      const level = levels.at(-1);
      const shift = level && !prefix.includes(">") ? level.outputContent - level.inputContent : 0;
      formatted = (shift ? " ".repeat(width + shift) : prefix) + formatProse(text.slice(prefix.length), options);
    }

    if (options.lintTrailingSpaces !== false) {
      const trailing = /[ \t]+$/.exec(text);
      formatted = formatted.replace(/[ \t]+$/, "");
      if (formatted && !heading && options.lintHardBreaks !== false && trailing && /^ {2,}$/.test(trailing[0])) {
        formatted += "  ";
      }
    }
    result.push({ ...row, text: hasBom ? "\uFEFF" + formatted : formatted });
  }

  if (options.lintFinalNewline !== false) {
    while (result.length && !result.at(-1).text.trim() && !result.at(-1).protected) result.pop();
    if (result.length && !result.at(-1).ending && !result.at(-1).protected) result.at(-1).ending = ending;
  }
  return result.map((row) => row.text + row.ending).join("");
}
