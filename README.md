# Typora Extensions

The source of every extension and theme in the Typora store, and the tooling
that builds and publishes [extensions.typora.io](https://extensions.typora.io)
and [theme2.typora.io](https://theme2.typora.io).

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
themes/<id>/                one folder per theme package, named after its id
  typora-extension.json     the manifest: contributes only themes
  themes/<name>/theme.toml  the theme (docs.typora.io/extensions/themes)
  cover.webp                gallery tile, 5:4 (not packaged)
  screenshot.webp           the theme's page, 16:10 (not packaged)
themes/built-in/<name>/     themes that ship with Typora: listed, not packaged
  theme.json                name, colorScheme, description
  cover.webp, screenshot.webp
scripts/
  validate.mjs              manifest and file checks (npm run validate)
  permission-diff.mjs       permission / version diff against a base ref (PRs)
  build.mjs                 packages, index.json and both websites → dist/
  language-packs.mjs        (re)generates the typora.lang-* language packs
  language-pack-images.mjs  their cover / screenshot images (.claude/skills/language-pack-images)
  site.mjs                  HTML templates for the website
  serve.mjs                 local server that mimics the Worker
site/                       CSS, JS and images for the two websites, and the header's font
suggestions.json            editor's picks the app suggests in its command palette and / menu
worker.js, headers.js       Cloudflare Worker serving dist/ (wrangler.toml)
.github/workflows/          ci.yml (every push / PR), deploy.yml and deploy-aliyun.yml (main)
```

`npm run build` writes:

| Path | What |
| --- | --- |
| `dist/extensions/index.json` | The catalog the app reads (`schemaVersion: 1`), themes included |
| `dist/extensions/suggestions.json` | `suggestions.json` as is: the extensions the app offers while the user types |
| `dist/extensions/download/<id>-<version>.typora-extension` | The package: a zip with `typora-extension.json` at the archive root. Deterministic: the same source always gives the same SHA-256 |
| `dist/extensions/download/<id>-<version>.typora-theme` | A package from `themes/`, the same zip. The app installs from here |
| `dist/extensions/index.html`, `dist/extensions/<id>/index.html` | extensions.typora.io |
| `dist/themes/index.html`, `doc/index.html`, `<id>/index.html` | theme2.typora.io |
| `dist/themes/download/<id>-<version>.typora-theme` | The same package, for the site's Download button |
| `dist/*/assets/{covers,screenshots}/<id>.<hash>.<ext>` | Store images, linked from `index.json` as `cover` / `screenshot` |
| `dist/*/404.html`, `robots.txt`, `sitemap.xml` | |

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

## Themes

A theme in the store is an extension that contributes only themes: no code, no
permissions, no other contributions (`npm run validate` enforces it). That is
what lets it use the `.typora-theme` extension: opening one asks about a theme
instead of permissions. The app treats it as any other catalog entry for
search, updates and removal, and its page is on theme2.typora.io, which also
lists the themes built into Typora. extensions.typora.io leaves themes out of
its own pages.

Ids are unique across `extensions/` and `themes/`, since both share one
catalog. Store images come from `scripts/theme-images.mjs`, which opens the
theme in the real app:

```sh
node scripts/theme-images.mjs                     # every theme
node scripts/theme-images.mjs typora.ash github   # only these
```

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
npm run validate       # check every package (or: node scripts/validate.mjs <id>)
npm test               # unit tests
npm run build          # build dist/ for the two production sites
npm run dev            # build, and serve extensions on http://localhost:8788
npm run dev:themes     # build, and serve themes on http://localhost:8789
node scripts/permission-diff.mjs origin/main   # what a PR would show
```

To install from the local store in Typora, start it with
`TYPORA_EXTENSIONS_STORE=http://localhost:8788`. `npm run dev` builds the
catalog with `http://localhost:8788` URLs because the app only installs
downloads from the store origin.

Deploying (CI does this on every push to `main`): `npx wrangler deploy` and
`npx wrangler deploy --config wrangler.themes.toml` with `CLOUDFLARE_API_TOKEN`
and `CLOUDFLARE_ACCOUNT_ID` set.
