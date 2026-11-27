import { protectedLines } from "./rules/protected-blocks.js";

const PIPE_OR_CODE = /\\[^\r\n]|`+|\|/g;
const ALIGNMENT_CELL = /^:?-+:?$/;
const NUMBER = /^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$|^[+-]?\.\d+$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const pinyin = new Intl.Collator("zh-CN-u-co-pinyin");

function splitCells(line) {
  const text = line.trim();
  const tokens = [...text.matchAll(PIPE_OR_CODE)];
  const cells = [];
  let start = 0;
  let codeDelimiter = "";
  let trailingPipe = false;
  const lastCodeIndex = new Map(tokens.filter(([token]) => token.startsWith("`")).map((match) => [match[0], match.index]));
  for (const { 0: token, index } of tokens) {
    if (token === codeDelimiter) {
      codeDelimiter = "";
    } else if (!codeDelimiter && token.startsWith("`") && lastCodeIndex.get(token) > index) {
      codeDelimiter = token;
    } else if (!codeDelimiter && token === "|") {
      if (index !== 0) cells.push(text.slice(start, index).trim());
      start = index + 1;
      trailingPipe = start === text.length;
    }
  }
  if (!trailingPipe) cells.push(text.slice(start).trim());
  return { cells, hasPipe: start > 0 };
}

export function parseTable(markdown) {
  const ending = markdown.match(/\r\n|\n|\r/)?.[0] ?? "\n";
  const lines = markdown.split(/\r\n|\n|\r/);
  if (lines.at(-1) === "") lines.pop();
  const [headerLine, alignment, ...body] = lines;
  if (!headerLine || !alignment) return null;
  const header = splitCells(headerLine);
  const align = splitCells(alignment);
  if (!(header.hasPipe || align.hasPipe) || header.cells.length !== align.cells.length ||
      !align.cells.every((cell) => ALIGNMENT_CELL.test(cell))) return null;

  const rows = body.map(splitCells);
  if (rows.some((row) => !row.hasPipe || row.cells.length > header.cells.length)) return null;
  return {
    header: header.cells,
    headerLine,
    alignment,
    ending,
    bodyLines: body,
    rows: rows.map(({ cells }) => [...cells, ...Array(header.cells.length - cells.length).fill("")]),
  };
}

export function numericCell(value) {
  const text = value.trim();
  if (!NUMBER.test(text)) return NaN;
  const number = Number(text.replaceAll(",", ""));
  return Number.isFinite(number) ? number : NaN;
}

function isDate(value) {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function sortRows(rows, column, direction = "asc") {
  const decorated = rows.map((row) => ({ row, value: row[column]?.trim() ?? "", number: numericCell(row[column] ?? "") }));
  const nonempty = decorated.filter(({ value }) => value);
  const numeric = nonempty.every(({ number }) => Number.isFinite(number));
  const dates = !numeric && nonempty.every(({ value }) => isDate(value));
  const sign = direction === "desc" ? -1 : 1;
  decorated.sort((left, right) => {
    if (!left.value || !right.value) return Number(!left.value) - Number(!right.value);
    if (numeric) return sign * (left.number - right.number);
    if (dates) return sign * (left.value < right.value ? -1 : Number(left.value > right.value));
    return sign * pinyin.compare(left.value, right.value);
  });
  return decorated.map(({ row }) => row);
}

function renderRow(cells) {
  return `| ${cells.join(" | ")} |`;
}

export function renderTable(table, rows) {
  return [table.headerLine, table.alignment, ...rows.map(renderRow)].join(table.ending);
}

export function appendTotal(table) {
  const total = table.header.map((_, column) => {
    const values = table.rows.map((row) => row[column]).filter(Boolean);
    const numbers = values.map(numericCell);
    return numbers.length && numbers.every(Number.isFinite)
      ? String(numbers.reduce((sum, value) => sum + value, 0))
      : "";
  });
  if (total[0] === "") total[0] = "合计";
  return [table.headerLine, table.alignment, ...table.bodyLines, renderRow(total)].join(table.ending);
}

export function transposeTable(table) {
  const rows = table.header.map((heading, column) => [heading, ...table.rows.map((row) => row[column])]);
  return [renderRow(rows[0]), renderRow(rows[0].map(() => "---")), ...rows.slice(1).map(renderRow)].join(table.ending);
}

export function csvToTable(csv) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  let closed = false;
  const value = csv.replace(/^\uFEFF/, "").replace(/\r\n?|\n/g, "\n");
  function finishCell() {
    row.push(field.replace(/[\\|]/g, "\\$&").replace(/[<>]/g, (tag) => tag === "<" ? "&lt;" : "&gt;").replace(/\n/g, "<br>"));
    field = "";
    closed = false;
  }
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (quoted) {
      if (char !== '"') {
        field += char;
      } else if (value[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        quoted = false;
        closed = true;
      }
    } else if (char === "," || char === "\n") {
      finishCell();
      if (char === "\n") {
        rows.push(row);
        row = [];
      }
    } else if (char === '"' && !field && !closed) {
      quoted = true;
    } else {
      if (closed || char === '"') throw new Error(`CSV 第 ${i + 1} 字符：引号位置无效`);
      field += char;
    }
  }
  if (quoted) throw new Error(`CSV 第 ${value.length + 1} 字符：引号未闭合`);
  if (row.length || field || closed) {
    finishCell();
    rows.push(row);
  }
  const width = rows[0]?.length ?? 0;
  if (width < 2 || rows.some((cells) => cells.length !== width)) throw new Error("CSV 各行必须有相同的列数，且至少有两列");
  return [renderRow(rows[0]), renderRow(rows[0].map(() => "---")), ...rows.slice(1).map(renderRow)].join("\n");
}

export function findTables(markdown) {
  const lines = [...markdown.matchAll(/[^\r\n]*(?:\r\n|\r|\n|$)/g)]
    .filter(([line]) => line.length)
    .map(({ 0: line, index }) => ({ text: line.replace(/(?:\r\n|\r|\n)$/, ""), index }));
  const protectedRows = protectedLines(lines.map(({ text }) => text), { includeTables: false });
  const tables = [];
  for (let row = 0; row + 1 < lines.length; row++) {
    if (protectedRows.has(row) || protectedRows.has(row + 1)) continue;
    const head = splitCells(lines[row].text);
    const align = splitCells(lines[row + 1].text);
    if (!(head.hasPipe || align.hasPipe) || head.cells.length !== align.cells.length ||
        !align.cells.every((cell) => ALIGNMENT_CELL.test(cell))) continue;
    let last = row + 1;
    while (last + 1 < lines.length && !protectedRows.has(last + 1)) {
      const body = splitCells(lines[last + 1].text);
      if (!body.hasPipe || body.cells.length > head.cells.length) break;
      last++;
    }
    const start = lines[row].index;
    const end = lines[last].index + lines[last].text.trimEnd().length;
    const source = markdown.slice(start, end);
    const table = parseTable(source);
    if (table) tables.push({ start, end, source, table });
    row = last;
  }
  return tables;
}
