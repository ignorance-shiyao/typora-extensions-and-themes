# Typora Extensions

The source of every extension in the Typora extension store, and the
tooling that builds and publishes [extensions.typora.io](https://extensions.typora.io).

Extensions are never uploaded as binaries. Each one lives here as source,
every new extension and every update is a pull request, and Typora's CI
validates, packages and publishes what was reviewed. Users install from
Typora ▸ Settings ▸ Extensions, which reads the catalog at
`https://extensions.typora.io/index.json`.

To write an extension, start with the developer guide:
<https://docs.typora.io/extensions/>.

## Layout

```
extensions/<id>/            one folder per extension, named after its id
  typora-extension.json     the manifest (docs.typora.io/extensions/)
  cover.webp                optional store card image, 2:1 (not packaged)
  screenshot.webp           optional store page image, 16:10 (not packaged)
  …                         everything else the manifest references
scripts/
  validate.mjs              manifest and file checks (npm run validate)
  permission-diff.mjs       permission / version diff against a base ref (PRs)
  build.mjs                 packages, index.json and the website → dist/
  language-packs.mjs        (re)generates the typora.lang-* language packs
  language-pack-images.mjs  their cover / screenshot images (.claude/skills/language-pack-images)
  site.mjs                  HTML templates for the website
  serve.mjs                 local server that mimics the Worker
site/                       CSS, JS and icon for the website
worker.js, headers.js       Cloudflare Worker serving dist/ (wrangler.toml)
.github/workflows/          ci.yml (every push / PR), deploy.yml (main)
```

`npm run build` writes:

| Path | What |
| --- | --- |
| `dist/index.json` | The catalog the app reads (`schemaVersion: 1`) |
| `dist/download/<id>-<version>.typora-extension` | The package: a zip with `typora-extension.json` at the archive root. Deterministic: the same source always gives the same SHA-256 |
| `dist/index.html`, `dist/<id>/index.html` | The store website |
| `dist/assets/{covers,screenshots}/<id>.<hash>.<ext>` | Store images, linked from `index.json` as `cover` / `screenshot` |
| `dist/404.html`, `robots.txt`, `sitemap.xml` | |

Each catalog entry has a tier: **L0** (data only), **L1** (ships HTML
pages), **L2** (has `main` / `background` code). An entry with `os`
(`["darwin"]`) runs only on those platforms; without it, on all of them.

## Adding or updating an extension

1. Fork this repository and add `extensions/<your.id>/` (the folder name
   must equal the manifest `id`, e.g. `jane.plantuml`).
2. Try it in Typora: *Settings ▸ Extensions ▸ Install from File…* (pick the
   folder), or copy it into the Extensions folder (*Open Folder*), then
   *Reload* after each change.
3. Run `npm run validate` and `npm run build` locally.
4. Open a pull request. CI validates the manifest and files, prints a
   permission diff against `main` in the job summary, and builds the package.
5. After review and merge, the deploy workflow publishes the new version
   within a few minutes.

Every change to an extension's folder needs a version bump: published zips
are immutable and cached forever. Read [CONTRIBUTING.md](CONTRIBUTING.md)
for what reviewers check.

## Local development

Node 22, no dependencies.

```sh
npm ci                 # nothing to install, but keeps CI and local identical
npm run validate       # check every extension (or: node scripts/validate.mjs <id>)
npm run build          # build dist/ for https://extensions.typora.io
npm run dev            # build for http://localhost:8788 and serve it
node scripts/permission-diff.mjs origin/main   # what a PR would show
```

To install from the local store in Typora, start it with
`TYPORA_EXTENSIONS_STORE=http://localhost:8788`. `npm run dev` builds the
catalog with `http://localhost:8788` URLs because the app only installs
downloads from the store origin.

Deploying (CI does this on every push to `main`): `npx wrangler deploy`
with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` set.

## Extensions

| Extension | Shows | From |
| --- | --- | --- |
| `typora.kroki` | L0 Kroki fence renderers (PlantUML, Graphviz, D2, …), configuration, network permission | typora-issues#1138 |
| `typora.issue-links` | L0 inline rules: `#123` → issue URL, `#tag` → search + Tags detail view | |
| `typora.tasks` | L0 rule-based detail views over Iteration (open tasks, TODO notes, links) | typora_plugin TODO / right outline |
| `typora.math-pack` | L0 TeX macros and snippets | V1 users' MathJax macro requests |
| `typora.meeting-notes` | L0 templates and snippets | typora-issues#863 |
| `typora.chart` | L1 static fence renderer (` ```chart `) | typora_plugin chart / echarts |
| `typora.diagrams` | L1 static fence renderer with vendored libraries and WebAssembly: Graphviz, erd, Vega, Vega-Lite, WaveDrom, nomnoml, BPMN, offline | typora-issues#1138 |
| `typora.plantuml` | L1 static fence renderer that runs a local program (`plantuml`, or `java -jar plantuml.jar`, kept running in pipe mode) or calls Kroki; options form with `enumLabels` / `when` / `format: "file"`; `process` list + network | typora-issues#1138 |
| `typora.d2` | L1 static fence renderer that runs the local `d2` program or calls Kroki | typora-issues#1138 |
| `typora.kanban` | L1 interactive fence renderer with export snapshot (` ```kanban `) | typora_plugin kanban |
| `typora.csv-viewer` | L1 editable file viewer + `main` talking to the page, clipboard permission | file viewer discussion |
| `typora.writing-stats` | L2 `main` + `background` singleton, runtime ports, atomic storage, alarms, detail page | Obsidian-style daily writing goals |
| `typora.wordpress` | L2 `main` commands: copy as WordPress blocks / classic HTML (vendored marked), publish through the REST API to `{config.siteUrl}` (a network origin the user enters), uploading local images (`document.readImage`), clipboard, document write-back | typora-issues#1609 |
| `typora.ai-front-matter` | L2 `main` + `ai` permission: title, description, tags and slug from the user's model, reusing the open folder's tags (`workspace: read`) | |
| `typora.openverse` | L1 detail page: openly licensed image search (Openverse, no key) through `view.fetch`, thumbnails as `blob:` URLs, `view.insertMarkdown` with a credit line on click | |
| `typora.ipic` | L2 macOS-only (`os`) image uploader (`contributes.imageUploaders`): the iPic app's uploader protocol on a private pasteboard through `osascript` (`process: ["osascript"]`) | replaces Typora's built-in iPic option |
| `typora.lang-<locale>` | L0 language packs: UI translations (`localizations`) and Hunspell spelling dictionaries (`dictionaries`). Generated by `scripts/language-packs.mjs` from the Typora 1 catalogs and [dict.typora.io](https://github.com/typora/dict.typora.io) | Typora-i18n |
