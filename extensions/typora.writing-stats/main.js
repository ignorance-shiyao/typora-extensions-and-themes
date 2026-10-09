// Writing Stats — `main`, one per window. Watches the open document and
// reports words added to the extension's `background`, which keeps one
// total for the whole app (docs/extensions.md §7.3).
import { countWords } from "./words.js";

export async function activate(ctx) {
  const port = await typora.runtime.connect();
  ctx.subscriptions.push({ dispose: () => port.dispose() });

  let documentKey = null;
  let last = 0;

  async function measure() {
    const info = await typora.document.info();
    const key = info?.path ?? info?.name ?? "untitled";
    const words = countWords(await typora.editor.getMarkdown());
    if (key !== documentKey) {
      // Switching documents is not writing.
      documentKey = key;
      last = words;
      return;
    }
    const added = words - last;
    last = words;
    if (added > 0) await port.postMessage({ type: "added", words: added });
  }

  await measure();
  ctx.subscriptions.push(
    typora.document.onDidChange(() => void measure()),
    typora.commands.register("reset", async () => {
      await port.postMessage({ type: "reset" });
      await typora.ui.toast("Today's count is back to 0.");
    }),
  );
}
