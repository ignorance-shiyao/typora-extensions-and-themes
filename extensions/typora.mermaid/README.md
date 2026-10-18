# Mermaid.js

Typora draws ` ```mermaid ` code blocks with [Pele](https://pele.run), a
small and fast renderer for Mermaid's syntax with its own layout and look.
This extension draws them with the official
[Mermaid.js](https://mermaid.js.org) library instead, for diagrams that
should look exactly as they do on GitHub, GitLab or the Mermaid Live Editor,
or that use something Pele draws differently.

Once installed it draws every Mermaid diagram. To go back to the built-in
renderer without uninstalling, choose *Typora (Pele)* for `mermaid` in
*Settings ▸ Markdown ▸ Syntax by Extension*, or disable the extension.

Diagrams follow the light or dark appearance unless the source sets its own
theme. The library loads the first time a diagram is drawn, each diagram type's
code the first time that type is drawn; nothing is sent
anywhere, and the extension needs no permissions.

## Third-party code

| File | Package | License |
| --- | --- | --- |
| `vendor/mermaid.esm.min.mjs`, `vendor/chunks/mermaid.esm.min/` | [mermaid](https://github.com/mermaid-js/mermaid) 11.16.0 (`dist/mermaid.esm.min.mjs` and its chunks, without source maps), unchanged | MIT (`vendor/LICENSE-mermaid.txt`) |
