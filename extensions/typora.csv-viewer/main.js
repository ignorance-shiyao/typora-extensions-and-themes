// CSV Viewer — `main`: the viewer page posts a Markdown table here, and
// this puts it on the clipboard (pages have no clipboard access).
export function activate(ctx) {
  ctx.subscriptions.push(
    typora.views.registerFileViewer("csv", {
      resolve(doc, panel) {
        panel.entry = "viewer/index.html";
        panel.onMessage(async (message) => {
          if (message?.type !== "copyMarkdown") return;
          await typora.clipboard.writeText(message.markdown);
          await typora.ui.toast(`Copied ${message.rows} rows as a Markdown table.`);
        });
      },
    }),
  );
}
