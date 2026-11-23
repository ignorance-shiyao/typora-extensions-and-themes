import { protectedLines } from "./rules/protected-blocks.js";

const ITEM = /^([ \t]*)([-+*]|\d{1,9}[.)])([ \t]+)(.*)$/;

function width(indent) {
  let columns = 0;
  for (const char of indent) columns += char === "\t" ? 4 - columns % 4 : 1;
  return columns;
}

function sourceLines(markdown) {
  const parts = markdown.split(/(\r\n|\r|\n)/);
  const lines = [];
  const endings = [];
  for (let i = 0; i < parts.length; i += 2) {
    if (i === parts.length - 1 && !parts[i] && i > 0) break;
    lines.push(parts[i]);
    endings.push(parts[i + 1] ?? "");
  }
  return { lines, endings };
}

function listItems(lines) {
  const protectedRows = protectedLines(lines);
  const items = [];
  const stack = [];
  let roots;
  let blank = false;
  const closeTo = (size, end) => {
    while (stack.length > size) stack.pop().end = end;
  };
  for (const [row, line] of lines.entries()) {
    if (!line.trim()) {
      blank = true;
      continue;
    }
    const match = !protectedRows.has(row) && ITEM.exec(line);
    if (!match) {
      const indent = width(/^[ \t]*/.exec(line)[0]);
      if (!stack.length || indent < stack.at(-1).contentIndent) {
        closeTo(0, row);
        roots = undefined;
      }
      blank = false;
      continue;
    }
    const [, prefix, marker, gap, content] = match;
    const indent = width(prefix);
    if (blank && stack.length && indent === 0 && stack[0].marker.at(-1) !== marker.at(-1)) {
      closeTo(0, row);
      roots = undefined;
    }
    while (stack.length && indent < stack.at(-1).contentIndent) closeTo(stack.length - 1, row);
    const parent = stack.at(-1);
    if (!roots) {
      roots = [];
    }
    const siblings = parent?.children ?? roots;
    const item = { row, indent, contentIndent: width(prefix + " ".repeat(marker.length) + gap),
      marker, gap, content, parent, siblings, roots, children: [] };
    siblings.push(item);
    items.push(item);
    stack.push(item);
    blank = false;
  }
  closeTo(0, lines.length);
  return { items };
}

function shiftLine(line, delta) {
  if (!delta || !line.trim()) return line;
  const prefix = /^[ \t]*/.exec(line)[0];
  return " ".repeat(Math.max(0, width(prefix) + delta)) + line.slice(prefix.length);
}

function effectiveEnd(lines, item) {
  let end = item.end;
  while (end > item.row + 1 && !lines[end - 1].trim()) end--;
  return end;
}

function normalizedOrder(lines, roots) {
  let previousDelimiter = "";
  let number = 0;
  for (const item of roots) {
    const delimiter = /^\d/.test(item.marker) ? item.marker.at(-1) : "";
    if (delimiter !== previousDelimiter) number = 0;
    previousDelimiter = delimiter;
    if (delimiter) {
      const replacement = `${++number}${delimiter}`;
      const match = ITEM.exec(lines[item.row]);
      lines[item.row] = match[1] + replacement + item.gap + item.content;
      const delta = replacement.length - item.marker.length;
      if (delta) {
        for (let row = item.row + 1; row < item.end; row++) lines[row] = shiftLine(lines[row], delta);
      }
    }
    normalizedOrder(lines, item.children);
  }
}

export function inspectList(markdown) {
  const { lines } = sourceLines(markdown);
  return listItems(lines).items.map(({ row, content, parent }) => ({ row, content, parentRow: parent?.row }));
}

export function changeListItem(markdown, index, action) {
  const { lines, endings } = sourceLines(markdown);
  const { items } = listItems(lines);
  const item = items[index];
  if (!item) return markdown;
  const { siblings, parent, row } = item;
  const at = siblings.indexOf(item);
  const end = effectiveEnd(lines, item);
  let first;
  if (action === "up" || action === "down") {
    const neighbor = siblings[at + (action === "up" ? -1 : 1)];
    if (!neighbor) return markdown;
    const earlier = action === "up" ? neighbor : item;
    const later = action === "up" ? item : neighbor;
    first = earlier.row;
    const middle = effectiveEnd(lines, earlier);
    const last = effectiveEnd(lines, later);
    lines.splice(first, last - first, ...lines.slice(later.row, last), ...lines.slice(middle, later.row), ...lines.slice(first, middle));
  } else if (action === "demote") {
    const previous = siblings[at - 1];
    if (!previous) return markdown;
    const indent = previous.children.at(-1)?.indent ?? previous.contentIndent;
    lines.splice(row, end - row, ...lines.slice(row, end).map((line) => shiftLine(line, indent - item.indent)));
    first = previous.row;
  } else if (action === "promote") {
    if (!parent) return markdown;
    const target = effectiveEnd(lines, parent);
    const moved = lines.slice(row, end).map((line) => shiftLine(line, parent.indent - item.indent));
    lines.splice(row, target - row, ...lines.slice(end, target), ...moved);
    first = parent.row;
  } else {
    return markdown;
  }

  const changed = listItems(lines).items.find((entry) => entry.row === first);
  if (changed) normalizedOrder(lines, changed.roots);
  return lines.map((line, index) => line + endings[index]).join("");
}

export function listBranch(markdown, index) {
  const { lines, endings } = sourceLines(markdown);
  const item = listItems(lines).items[index];
  if (!item) return "";
  const end = effectiveEnd(lines, item);
  return lines.slice(item.row, end).map((line, index) => shiftLine(line, -item.indent) +
    (item.row + index + 1 < end ? endings[item.row + index] : "")).join("");
}

export function listOutline(markdown, index, limit) {
  const { lines, endings } = sourceLines(markdown);
  const item = listItems(lines).items[index];
  if (!item) return "";
  const output = [];
  function visit(siblings, depth) {
    for (const current of siblings) {
      output.push("  ".repeat(depth) + current.marker + " " + current.content);
      if (depth + 1 < limit) visit(current.children, depth + 1);
    }
  }
  visit(item.roots, 0);
  return output.join(endings.find(Boolean) ?? "\n");
}

export function textToList(markdown) {
  const { lines, endings } = sourceLines(markdown);
  const levels = [];
  return lines.map((line, row) => {
    if (!line.trim()) return endings[row];
    const indent = width(/^[ \t]*/.exec(line)[0]);
    while (levels.length && levels.at(-1) > indent) levels.pop();
    if (levels.at(-1) !== indent) levels.push(indent);
    return "  ".repeat(levels.length - 1) + "- " + line.trimStart() + endings[row];
  }).join("");
}

export function listToHeadings(markdown, start, end) {
  const { lines, endings } = sourceLines(markdown);
  const { items } = listItems(lines);
  let selected = items;
  if (start !== undefined && end !== undefined) {
    const first = items[Math.min(start, end)];
    const last = items[Math.max(start, end)];
    if (!first || !last || first.roots !== last.roots) return markdown;
    selected = items.slice(Math.min(start, end), Math.max(start, end) + 1);
  }
  for (const item of selected) {
    let level = 2;
    for (let p = item.parent; p; p = p.parent) level++;
    if (level > 6) throw new Error("列表超过五层，无法转换为 Markdown 标题");
    lines[item.row] = "#".repeat(level) + " " + item.content;
  }
  return lines.map((line, index) => line + endings[index]).join("");
}
