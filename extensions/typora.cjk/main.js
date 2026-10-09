// CJK Typography — `main` (runs in a sandboxed Worker; docs/extensions.md §7.3).
//
// "盘古之白": a space between CJK and Latin letters / digits. Code spans,
// fenced code, math, links and front matter are left alone.

const CJK = "\\u2e80-\\u2eff\\u2f00-\\u2fdf\\u3040-\\u309f\\u30a0-\\u30ff\\u3100-\\u312f\\u3200-\\u32ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff";
const AN = "A-Za-z0-9";
const CJK_THEN_AN = new RegExp(`([${CJK}])([${AN}@#$%&+=(\\[])`, "g");
const AN_THEN_CJK = new RegExp(`([${AN}%)\\]!?.,;:])([${CJK}])`, "g");

function spaceLine(line) {
  return line.replace(CJK_THEN_AN, "$1 $2").replace(AN_THEN_CJK, "$1 $2");
}

/** Apply to prose only: skip front matter, fences, math blocks and inline code / math / links. */
export function addSpacing(markdown) {
  const lines = markdown.split("\n");
  let fence = null;
  let math = false;
  let frontMatter = lines[0] === "---";
  return lines
    .map((line, index) => {
      if (frontMatter) {
        if (index > 0 && (line === "---" || line === "...")) frontMatter = false;
        return line;
      }
      const opener = /^\s*(`{3,}|~{3,})/.exec(line);
      if (fence) {
        if (opener && opener[1][0] === fence[0] && opener[1].length >= fence.length) fence = null;
        return line;
      }
      if (opener) {
        fence = opener[1];
        return line;
      }
      if (/^\s*\$\$\s*$/.test(line)) {
        math = !math;
        return line;
      }
      if (math) return line;
      // Keep `code`, $math$, [text](url) and <html> untouched.
      return line
        .split(/(`[^`]*`|\$[^$]+\$|\]\([^)]*\)|<[^>]+>|https?:\/\/\S+)/)
        .map((part, i) => (i % 2 ? part : spaceLine(part)))
        .join("");
    })
    .join("\n");
}

export function activate(ctx) {
  ctx.subscriptions.push(
    typora.commands.register("spacing", async () => {
      const before = await typora.editor.getMarkdown();
      const after = addSpacing(before);
      if (after === before) {
        await typora.ui.toast("Nothing to change.");
        return;
      }
      await typora.editor.replaceDocument(after);
    }),
    typora.formatters.register("spacing", addSpacing, { title: "CJK Spacing" }),
  );
}
