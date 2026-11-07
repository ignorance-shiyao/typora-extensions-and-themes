# Mind Map

Explore the current document's outline in the **Mind Map** detail tab.

- Click a branch label or its fold circle to collapse or expand it, with
  Markmap's native animation. Leaf labels navigate to the editor.
- Drag or scroll with two fingers to pan. Pinch to zoom, or use the zoom
  buttons. WebKit gesture events and ctrl-wheel pinch events are both supported.
- The **…** menu selects **Tree**, **Two-sided** or **Org chart** layout;
  **Classic**, **Cards** or **Minimal** style; and an expanded **Level 1–6**
  or **All levels**. The root is level 1. Choices are saved locally.
- **Full size** spans the editor and detail-panel area while keeping the file
  sidebar. The detail panel closes temporarily and returns on exit or Escape.
  Folded branches and the panel's viewport survive the round trip.

Layouts, themes, branch colors and folding animations come from the official
Markmap library. The page is transparent and follows light/dark appearance.
The floating toolbar uses Typora's Toolbar and Button components with icons
supplied by this extension. Older hosts retain local zoom and options controls;
fullsize and the host dropdown require the updated View SDK.

The extension requests only `document: read` to receive the document blocks
and navigate to headings. Only document-root headings participate, as in
Outline. No network access is used. It builds an outline from the existing
block API; raw labels strip common Markdown syntax. It does not follow the
caret. Closing the page resets folds and viewport; layout/style/level persist.

## Third-party code

Uses official `@markmap/view`, `@markmap/render` and `@markmap/core`
**1.0.0-next.0** (MIT), pinned to this prerelease for its native layouts and
styles. The readable ESM bundle and chunks are in `vendor/`; all dependency
license notices are in `vendor/LICENSES.txt`. There is no CDN or runtime fetch.

The bundle is generated without minification from published npm packages.
Its source entry, build script and exact dependency lock are in
`extensions/scripts/mindmap-vendor/`. Rebuild from the repository root:

```sh
npm ci --prefix extensions/scripts/mindmap-vendor --ignore-scripts
node extensions/scripts/mindmap-vendor/build.mjs
```
