import { calculateTable } from "./table-formula.js";
import { appendTotal, csvToTable, findTables, renderTable, sortRows, transposeTable } from "./table-tools.js";

const FORMULA = /^(?:\r\n|\r|\n)[ \t\r\n]*<!--\s*tblfm\s*:\s*([^\r\n]*?)\s*-->/;
const ACTIONS = ["table-sort-asc", "table-sort-desc", "table-recalculate", "table-total", "table-transpose"];

function selectionTable(blocks, anchor) {
  const byId = new Map(blocks.map((block) => [block.id, block]));
  let column;
  let block = byId.get(anchor.blockId);
  while (block && block.type !== "table") {
    if (block.type === "table_cell") {
      column = blocks.filter((cell) => cell.type === "table_cell" && cell.parent === block.parent)
        .findIndex((cell) => cell.id === block.id);
    } else if (Number.isInteger(block.attrs?.columnIndex)) {
      column = block.attrs.columnIndex;
    }
    block = byId.get(block.parent);
  }
  return { block, column };
}

function sameCells(source, host) {
  return source.length === host.length && source.every((cell, index) => cell === host[index]);
}

function locateTable(markdown, blocks, target) {
  const candidates = findTables(markdown);
  const tables = blocks.filter((block) => block.type === "table");
  if (tables.length !== candidates.length) return null;
  const index = tables.indexOf(target);
  const location = candidates[index];
  if (!location) return null;
  if (target.text) return target.text.trimEnd() === location.source ? location : null;
  const rows = blocks.filter((block) => block.type === "table_row" && block.parent === target.id);
  const cells = [location.table.header, ...location.table.rows];
  const match = rows.length === cells.length && rows.every((row, index) => {
    const host = blocks.filter((cell) => cell.type === "table_cell" && cell.parent === row.id).map((cell) => cell.text ?? "");
    return sameCells(cells[index], host);
  });
  return match ? location : null;
}

async function applyTable(api, action) {
  const selection = await api.editor.getSelection();
  if (!selection?.anchor) return api.ui.toast("请将光标放在表格内");
  const blocks = await api.document.getBlocks();
  const { block, column } = selectionTable(blocks, selection.anchor);
  if (!block) return api.ui.toast("请将光标放在表格内");
  const markdown = await api.editor.getMarkdown();
  const location = locateTable(markdown, blocks, block);
  if (!location) return api.ui.toast("无法唯一定位当前表格");
  const { start, end, source, table } = location;
  let replacement;
  let errors = [];
  if (action === "table-recalculate") {
    const formula = FORMULA.exec(markdown.slice(end))?.[1];
    if (!formula) return api.ui.toast("表格下方没有 tblfm 公式");
    const result = calculateTable(table.rows, formula);
    errors = result.errors;
    replacement = renderTable(table, result.rows);
  } else if (action === "table-total") {
    replacement = appendTotal(table);
  } else if (action === "table-transpose") {
    replacement = transposeTable(table);
  } else {
    let sortColumn = column;
    if (sortColumn === undefined) {
      const input = await api.ui.input({
        prompt: `排序列（1–${table.header.length}）`,
        placeholder: table.header.map((heading, index) => `${index + 1} ${heading}`).join("、"),
      });
      if (input == null) return;
      sortColumn = /^\d+$/.test(input.trim()) ? Number(input) - 1 : -1;
    }
    if (sortColumn < 0 || sortColumn >= table.header.length) return api.ui.toast("排序列不存在");
    replacement = renderTable(table, sortRows(table.rows, sortColumn, action === "table-sort-desc" ? "desc" : "asc"));
  }
  if (replacement !== source) {
    if (await api.editor.getMarkdown() !== markdown) return api.ui.toast("文档已变化，请重新执行");
    await api.editor.replaceDocument(markdown.slice(0, start) + replacement + markdown.slice(end));
  }
  if (errors.length) await api.ui.toast(errors.join("\n"));
}

export function registerTableCommands(api, subscriptions) {
  for (const action of ACTIONS) {
    subscriptions.push(api.commands.register(action, () => applyTable(api, action)));
  }
  subscriptions.push(api.commands.register("table-csv-convert", async () => {
    const selection = await api.editor.getSelection();
    if (!selection?.markdown?.trim()) return api.ui.toast("请先选中 CSV 文本");
    let table;
    try {
      table = csvToTable(selection.markdown);
    } catch (error) {
      return api.ui.toast(error.message);
    }
    await api.editor.replaceRange({ anchor: selection.anchor, focus: selection.focus }, table);
  }));
}
