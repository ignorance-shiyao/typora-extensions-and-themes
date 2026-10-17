# Offline Diagrams

Draws these code blocks on your computer, with libraries that ship in the
extension. Nothing is sent anywhere, and it needs no permissions.

| Fence | Draws |
| --- | --- |
| ` ```graphviz `, ` ```dot ` | [Graphviz](https://graphviz.org/doc/info/lang.html) DOT graphs |
| ` ```erd ` | Entity-relationship diagrams in [erd](https://github.com/BurntSushi/erd)'s syntax, laid out by Graphviz |
| ` ```vega-lite `, ` ```vegalite ` | [Vega-Lite](https://vega.github.io/vega-lite/) charts (JSON) |
| ` ```vega ` | [Vega](https://vega.github.io/vega/) visualizations (JSON) |
| ` ```wavedrom ` | [WaveDrom](https://wavedrom.com) timing diagrams (WaveJSON) |
| ` ```nomnoml ` | [nomnoml](https://nomnoml.com) UML diagrams |
| ` ```bpmn ` | [BPMN 2.0](https://bpmn.io) process diagrams (XML with diagram layout) |

Diagrams follow the light or dark appearance unless the source sets its own
colors. Each library loads the first time one of its diagrams is drawn.

Vega and Vega-Lite charts take their data from `"values"` in the spec:
Typora does not let the extension load data from files or URLs.

## Third-party code

`vendor/` holds these libraries unchanged from npm, each with its license:

| File | Package | License |
| --- | --- | --- |
| `graphviz.js` | [@hpcc-js/wasm-graphviz](https://github.com/hpcc-systems/hpcc-js-wasm) 1.29.2 (`dist/index.js`), Graphviz compiled to WebAssembly | Apache-2.0 (`LICENSE-hpcc-js-wasm-graphviz.txt`) |
| `vega.min.js` | [vega](https://github.com/vega/vega) 6.4.0 (`build/vega.min.js`) | BSD-3-Clause (`LICENSE-vega.txt`) |
| `vega-lite.min.js` | [vega-lite](https://github.com/vega/vega-lite) 6.5.0 (`build/vega-lite.min.js`) | BSD-3-Clause (`LICENSE-vega-lite.txt`) |
| `wavedrom.unpkg.min.js`, `wavedrom-dark.js` | [wavedrom](https://github.com/wavedrom/wavedrom) 3.7.0 (`wavedrom.unpkg.min.js`, `skins/dark.js`) | MIT (`LICENSE-wavedrom.txt`) |
| `nomnoml.js`, `graphre.js` | [nomnoml](https://github.com/skanaar/nomnoml) 1.7.0 and [graphre](https://github.com/skanaar/graphre) 0.1.3 (`dist/`) | MIT (`LICENSE-nomnoml.txt`, `LICENSE-graphre.txt`) |
| `bpmn-viewer.production.min.js` | [bpmn-js](https://github.com/bpmn-io/bpmn-js) 18.31.0 (`dist/`) | bpmn.io license (`LICENSE-bpmn-js.txt`) |

`vega-interpreter.js` is [vega-interpreter](https://github.com/vega/vega/tree/main/packages/vega-interpreter)
2.3.2 with vega-util 2.1.3 bundled into one readable script by esbuild
(`esbuild vega-interpreter.entry.js --bundle --format=iife --global-name=vegaInterpreter`).
Typora's extension pages forbid generated code, so Vega evaluates
expressions with the interpreter instead.

bpmn-js asks that its bpmn.io mark stays visible on rendered diagrams; the
exported drawing doesn't include the viewer's overlay, so the extension adds
a small "Powered by bpmn.io" line under each BPMN diagram.
