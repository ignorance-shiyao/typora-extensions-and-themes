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
suggestions.json            editor's picks the app suggests in its command palette and / menu
worker.js, headers.js       Cloudflare Worker serving dist/ (wrangler.toml)
.github/workflows/          ci.yml (every push / PR), deploy.yml and deploy-aliyun.yml (main)
```

`npm run build` writes:

| Path | What |
| --- | --- |
| `dist/index.json` | The catalog the app reads (`schemaVersion: 1`) |
| `dist/suggestions.json` | `suggestions.json` as is: the extensions the app offers while the user types |
| `dist/download/<id>-<version>.typora-extension` | The package: a zip with `typora-extension.json` at the archive root. Deterministic: the same source always gives the same SHA-256 |
| `dist/index.html`, `dist/<id>/index.html` | The store website |
| `dist/assets/{covers,screenshots}/<id>.<hash>.<ext>` | Store images, linked from `index.json` as `cover` / `screenshot` |
| `dist/404.html`, `robots.txt`, `sitemap.xml` | |

`suggestions.json` is Typora's own short list, not a manifest field, so an
extension can't nominate itself. Each entry names the extension, the surface
(`palette` or `slash`), the row's `title` (`l10n` for its translations), the
`terms` that bring it up and, for `slash`, the `fence` language to insert.
The app ships a copy (`packages/workbench/resources/extension-suggestions.json`)
and matches it on the device; keep the two the same. `npm run validate` checks
every entry against its manifest.

Each catalog entry has a tier: **L0** (data only), **L1** (ships HTML
pages), **L2** (has `main` / `background` code). An entry with `os`
(`["darwin"]`) runs only on those platforms; without it, on all of them.

An entry with `unlisted: true` remains in `index.json` for direct-link
installation but is excluded from homepage cards, website and app search,
and the sitemap. Its direct page and downloads still work; the page carries
`noindex`. In `typora-extension.json`, omit this optional boolean or set it
to `false` for public listing. This controls discovery, not access. See
[CONTRIBUTING.md](./CONTRIBUTING.md) for publishing requirements.

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
