# D2 Diagrams

Draws ` ```d2 ` code blocks with [D2](https://d2lang.com). Choose how in
*Settings ▸ Extensions ▸ D2 Diagrams ▸ Options*:

| Draw with | Needs | Offline |
| --- | --- | --- |
| **d2 command** (default) | [d2](https://d2lang.com/tour/install) on your PATH, e.g. `brew install d2` | Yes |
| **Kroki server** | A network connection; the source goes to [kroki.io](https://kroki.io) or your own Kroki | No |

With the d2 command, diagrams follow the light or dark appearance, and the
options pick the layout engine (dagre or ELK) and the hand-drawn look —
unless the diagram sets `theme-id`, `pad`, `layout-engine` or `sketch` in
`vars: { d2-config: { … } }`.

D2's own WebAssembly build is not used: its layout runs generated
JavaScript, which Typora's extension pages do not allow.

## Permissions

- `process: ["d2"]` — runs `d2 [--theme=…] [--pad=24] [--layout=…] [--sketch] - -`
  with the fence's source on stdin, by name from your PATH or at the full
  path set in the options. Nothing else. Typora only allows this after you
  turn on *Settings ▸ Extensions ▸ Allow extensions to run programs* and
  accept the permission.
- `network: ["https://kroki.io"]` — only with *Kroki server*: the fence's
  source is posted to `https://kroki.io/d2/svg`.
