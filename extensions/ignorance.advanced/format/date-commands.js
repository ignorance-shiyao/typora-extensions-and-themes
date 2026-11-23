import { formatNaturalDate, parseNaturalDate } from "./natural-date.js";

function formattedInput(api, text) {
  const settings = api.settings.get();
  const date = parseNaturalDate(text, new Date(), { weekStart: settings.dateWeekStart });
  return formatNaturalDate(date, settings.dateFormat);
}

function tryDate(api, text) {
  try {
    return formattedInput(api, text);
  } catch (error) {
    api.ui.toast(error.message);
    return undefined;
  }
}

export function registerDateCommands(api, subscriptions) {
  subscriptions.push(
    api.commands.register("date-insert", async () => {
      const text = await api.ui.input({ prompt: "插入日期", placeholder: "下周一" });
      if (text === null) return;
      const value = tryDate(api, text);
      if (!value) return;
      const choice = await api.ui.quickPick([value], { placeholder: "确认插入日期" });
      if (choice !== null) await api.editor.insertMarkdown(value);
    }),
    api.commands.register("date-convert", async () => {
      const selection = await api.editor.getSelection();
      if (!selection?.markdown?.trim()) return api.ui.toast("请先选中日期文字");
      const value = tryDate(api, selection.markdown);
      if (value) {
        await api.editor.replaceRange({ anchor: selection.anchor, focus: selection.focus }, value);
      }
    }),
  );
}
