# Contributing an extension

Every extension in the store lives in this repository as source. New
extensions and updates are pull requests; Typora's CI builds and publishes
exactly what was reviewed. Review complements the sandbox rather than
replacing it: extensions still run in a sandbox with the permissions they
declare, so reviewers check those permissions and the code that uses them,
not every line for escapes.

## Submitting

- One extension per pull request, in `extensions/<id>/`. The folder name
  equals the manifest `id` (`author.name`: lowercase letters, digits, dots,
  hyphens). The id is permanent.
- `name`, `version` (semver) and a one-sentence `description` are required;
  `author`, `tags` and `keywords` help people find it. `tags` are the
  store's filters: `Language Pack`, `Markdown Extension`, `Diagram`,
  `Math`, `Theme`, `Writing`, `Template`, `Productivity`, `File Viewer`,
  `View`, `Developer`.
- Store images (not packaged), Typora showing the extension at work:
  - `cover.webp`: 800 × 400 (2:1), on the store card. Crop it from the
    screenshot without the window title bar.
  - `screenshot.webp`: 1760 × 1100 (16:10, a 880 × 550 window at 2x, no
    scrollbars), on the extension's page.
  Use lossless WebP for screenshots so text stays sharp, and keep each
  image under 300 KB (validate warns). PNG and JPEG also work, up to 1 MB.
  Language packs get both from `scripts/language-pack-images.mjs`.
- Bump `version` with every change to the folder. Published downloads are
  immutable; CI fails a PR that changes files without a bump. Store images
  alone are exempt.
- A `README.md` in the folder is shown on the extension's store page.
- Run `npm run validate` before pushing.

## Automated checks (every PR)

- Manifest: required fields, id pattern, folder name, permission shapes,
  every referenced file (`main`, `background`, entries, templates,
  snippets) exists.
- Files: no symbolic links, at most 1 MB per file and 5 MB per extension.
- Vendored libraries (like xterm.js) are taken unchanged from their
  published package and named with their version in the README; their
  minified-line warning is expected.
- Code: flags `eval(`, `new Function(`, remote `import()` /
  `importScripts()` / `<script src>` and very long (minified) lines.
- Permission diff against `main`: permissions added or removed, network
  origins, tier change, and the review depth below. It is printed in the
  job summary.

## Review depth follows permissions

| The extension | Review |
| --- | --- |
| L0 (data only), no `network` | Automated checks plus a light review |
| Declares `network`, `document`, `workspace` or `clipboard` | Human review of the code paths that use them |
| Declares `process` | Human review of every place it starts a program, and why it needs to; the README says what it runs |
| An update that widens permissions | Human review; users are asked to consent again on update |

## Rules

- **No remote code.** Everything that runs ships in the package. Do not
  load scripts, styles or WebAssembly from the network, and do not `eval`
  or `new Function` anything that was fetched or read from a document.
- **No minified or obfuscated sources.** Commit readable source. If you
  use a build step, commit its output in readable form together with the
  source, and say so in the PR.
- **Ask for the least.** Request only the permissions you use; list
  network origins exactly (`https://kroki.io`, not `https://*`). Explain
  each permission in the PR description.
- **Programs come from the system or from source.** With `process`, run
  programs the user has (a shell, `git`, `pandoc`) or ones Typora's CI
  builds from source in this repository; prebuilt `binaries` are not
  accepted. Name the commands (`["git"]`) unless the extension is a
  terminal; `"*"` needs a reason in the PR description.
- **Widening permissions needs re-review.** Adding an origin, going from
  `document: read` to `write`, or adding `workspace` / `clipboard` is a
  separate, explicit change in the PR description.
- **Documents are data.** Treat fence bodies, front matter and file
  contents as untrusted input.
- Keep the package small: no `node_modules`, no build caches, no test
  fixtures that users do not need. Dotfiles are not packaged.

Reviewers may ask for changes or decline extensions that duplicate built-in
features, collect data without saying so, or are not maintained. A
published version that turns out to be harmful is revoked and disabled in
the app.

See the [developer guide](https://docs.typora.io/extensions/) for the
manifest, contribution points and the runtime API.
