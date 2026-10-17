---
name: language-pack-images
description: Generate the store images (cover.webp 2:1 and screenshot.webp 16:10) for Typora language packs, extensions/typora.lang-*. Use after adding a language pack, after changing a pack's name or its menu translations (File, Edit, New, Save …), or when asked to (re)make language pack covers, banners or screenshots for extensions.typora.io.
---

# Language pack images

Every language pack shows the same kind of picture on extensions.typora.io:
the language's own name, its English name, and a Typora window whose menu
bar and File menu are in that language. `scripts/language-pack-images.mjs`
renders them from each pack's manifest and translations, so never draw or
edit these images by hand.

| File | Size | Where |
| --- | --- | --- |
| `extensions/typora.lang-<x>/cover.webp` | 800×400 (2:1) | the card on the home page |
| `extensions/typora.lang-<x>/screenshot.webp` | 1760×1100 (16:10) | the extension's page |

Store images are not packaged, and changing only them needs no version bump.

## Steps

1. Use macOS: the picture needs system fonts for every script (CJK, Arabic,
   Hebrew, Devanagari, Thai …). Elsewhere glyphs come out as boxes.
2. Install Playwright without touching `package.json` (the repo has no
   dependencies):

   ```sh
   npm install --no-save --no-package-lock playwright
   npx playwright install chromium
   ```

3. Render, for every pack or only the ones that changed:

   ```sh
   node scripts/language-pack-images.mjs
   node scripts/language-pack-images.mjs typora.lang-ja typora.lang-ko
   ```

   It writes `cover.webp` and `screenshot.webp` (lossy WebP, encoded by
   Chromium's canvas) into each pack and removes older PNG / JPEG ones.

4. Check the result before committing. Open a few covers, at least one
   right-to-left pack (`typora.lang-ar`, `-fa`, `-he`: mirrored layout), one
   CJK pack, one with a long name (`typora.lang-de-ch`) and
   `typora.lang-en` (spelling dictionaries, no translations: shows a
   misspelled word with suggestions instead of the File menu). Look for
   boxes instead of glyphs, a name that does not fit, or English menu items
   in a translated pack (a missing translation; add it to the pack's
   catalog).
5. `npm run validate` (warns when a PNG is not 2:1 / 16:10) and
   `npm run build`, then `npm run serve` and look at
   `http://localhost:8788/?tag=language-pack`.
6. Commit only the images and any script change.

## Changing the design

Edit `page()` in `scripts/language-pack-images.mjs`: the menu items are
`MENUS` / `FILE_MENU` (English source strings, looked up in the pack's
translations), the colors come from a hue derived from the locale, and
every size is relative to the viewport height so both images share one
layout. Then regenerate every pack so the store stays consistent.
