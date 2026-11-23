import { changeListItem, inspectList, listBranch, listOutline, listToHeadings, textToList } from "./outliner.js";

const ACTIONS = {
  "outline-up": "up",
  "outline-down": "down",
  "outline-promote": "promote",
  "outline-demote": "demote",
};

function currentListItem(blocks, anchor) {
  const byId = new Map(blocks.map((block) => [block.id, block]));
  let current = byId.get(anchor.blockId);
  while (current && current.type !== "list_item") current = byId.get(current.parent);
  if (!current) return undefined;
  const items = blocks.filter((block) => block.type === "list_item");
  return { index: items.indexOf(current), items, byId };
}

function matchingListTree(source, context) {
  if (source.length !== context.items.length) return false;
  const rowsById = new Map(context.items.map((block, index) => [block.id, source[index].row]));
  return context.items.every((block, index) => {
    let parent = context.byId.get(block.parent);
    while (parent && parent.type !== "list_item") parent = context.byId.get(parent.parent);
    return source[index].parentRow === rowsById.get(parent?.id);
  });
}

async function activeList(api) {
  const selection = await api.editor.getSelection();
  if (!selection?.anchor) {
    await api.ui.toast("请将光标放在列表内");
    return undefined;
  }
  const blocks = await api.document.getBlocks();
  const context = currentListItem(blocks, selection.anchor);
  if (!context) {
    await api.ui.toast("请将光标放在列表内");
    return undefined;
  }
  const markdown = await api.editor.getMarkdown();
  if (!matchingListTree(inspectList(markdown), context)) {
    await api.ui.toast("无法核对当前列表结构");
    return undefined;
  }
  return { markdown, index: context.index, blockId: blocks[0]?.id };
}

async function convertListSelection(api, selection) {
  if (!selection?.anchor || !selection.focus || selection.anchor.blockId === selection.focus.blockId) return false;
  const blocks = await api.document.getBlocks();
  const first = currentListItem(blocks, selection.anchor);
  const last = currentListItem(blocks, selection.focus);
  if (!first || !last || first.index === last.index) return false;
  const markdown = await api.editor.getMarkdown();
  if (!matchingListTree(inspectList(markdown), first)) throw new Error("无法核对当前列表结构");
  const next = listToHeadings(markdown, first.index, last.index);
  if (next === markdown) throw new Error("请在同一列表内选择要转换的项目");
  if (await api.editor.getMarkdown() !== markdown) throw new Error("文档已变化，请重新执行");
  await api.editor.replaceDocument(next);
  return true;
}

async function showInOutline(api, context, markdown) {
  if (!context.blockId) return;
  const stamp = Date.now();
  if (new TextEncoder().encode(markdown).length > 200_000) return api.ui.toast("列表太长，无法预览");
  await api.storage.update("outline-preview", (previous) => {
    const recent = Object.entries(previous ?? {}).filter(([id, data]) => id !== context.blockId && stamp - data.stamp < 300_000)
      .sort((a, b) => b[1].stamp - a[1].stamp).slice(0, 3);
    return Object.fromEntries([[context.blockId, { markdown, stamp }], ...recent]);
  });
  return api.ui.toast("在「列表大纲」侧栏查看");
}

export function registerOutlinerCommands(api, subscriptions) {
  for (const [id, action] of Object.entries(ACTIONS)) {
    subscriptions.push(api.commands.register(id, async () => {
      const context = await activeList(api);
      if (!context) return;
      const next = changeListItem(context.markdown, context.index, action);
      if (next === context.markdown) return;
      if (await api.editor.getMarkdown() !== context.markdown) return api.ui.toast("文档已变化，请重新执行");
      await api.editor.replaceDocument(next);
    }));
  }
  subscriptions.push(api.commands.register("outline-branch", async () => {
    const context = await activeList(api);
    if (!context) return;
    await showInOutline(api, context, listBranch(context.markdown, context.index));
  }));
  subscriptions.push(api.commands.register("outline-depth", async () => {
    const context = await activeList(api);
    if (!context) return;
    const levels = await api.ui.input({ prompt: "显示层数", value: "2" });
    if (levels == null) return;
    if (!/^[1-9]\d?$/.test(levels.trim())) return api.ui.toast("请输入 1 至 99");
    const outline = listOutline(context.markdown, context.index, Number(levels));
    await showInOutline(api, context, outline);
  }));
  for (const [id, convert] of [["outline-to-list", textToList], ["outline-to-headings", listToHeadings]]) {
    subscriptions.push(api.commands.register(id, async () => {
      const selection = await api.editor.getSelection();
      let replacement;
      try {
        if (id === "outline-to-headings" && await convertListSelection(api, selection)) return;
        if (!selection?.markdown?.trim()) return api.ui.toast("请先选中文字");
        replacement = convert(selection.markdown);
      } catch (error) {
        return api.ui.toast(error.message);
      }
      if (replacement !== selection.markdown) {
        await api.editor.replaceRange({ anchor: selection.anchor, focus: selection.focus }, replacement);
      }
    }));
  }
}
