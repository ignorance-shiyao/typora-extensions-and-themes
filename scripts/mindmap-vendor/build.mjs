import { build } from "esbuild";
import { readFile, readdir, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const output = resolve(here, "../../extensions/typora.mindmap/vendor");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await build({
  entryPoints: [resolve(here, "entry.js")], outdir: output,
  entryNames: "markmap", chunkNames: "chunks/[name]-[hash]",
  bundle: true, splitting: true, format: "esm", minify: false,
  legalComments: "inline", target: "es2022",
});
const notices = [];
async function licenses(folder) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const path = resolve(folder, entry.name);
    if (entry.name.startsWith("@")) { await licenses(path); continue; }
    let pkg;
    try { pkg = JSON.parse(await readFile(resolve(path, "package.json"), "utf8")); } catch { continue; }
    for (const file of await readdir(path)) if (/^(license|copying)(\.|$)/i.test(file)) {
      notices.push(`${pkg.name}@${pkg.version}\n${await readFile(resolve(path, file), "utf8")}`);
    }
  }
}
await licenses(resolve(here, "node_modules"));
await writeFile(resolve(output, "LICENSES.txt"), notices.sort().join("\n\n---\n\n"));
