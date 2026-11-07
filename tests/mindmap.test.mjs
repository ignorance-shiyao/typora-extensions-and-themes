import assert from "node:assert/strict";
import test from "node:test";
import { collectFolds, documentOutline, outlineTree } from "../extensions/typora.mindmap/view/model.js";
import { checkManifest, packageDir, readManifest } from "../scripts/lib.mjs";

test("mind map is an offline L1 detail page with read-only document access", () => {
  const manifest = readManifest("typora.mindmap");
  assert.deepEqual(checkManifest(manifest, packageDir(manifest.id), manifest.id).errors, []);
  assert.deepEqual(manifest.permissions, { document: "read" });
  assert.equal(manifest.main, undefined);
  assert.equal(manifest.contributes.detailViews[0].entry, "view/index.html");
});

const heading = (id, level, text = id) => ({ id, level, text });

test("original blocks-only events produce a top-level outline with stable navigation ids", () => {
  const blocks = [
    { id: "title", type: "heading", depth: 0, attrs: { level: 1 }, text: "# Python Cheatsheet" },
    { id: "body", type: "paragraph", depth: 0, attrs: {}, text: "## Not a heading" },
    { id: "types", type: "heading", depth: 0, attrs: { level: 2 }, text: "## Variables &amp; **Data Types** ##" },
    { id: "quoted", type: "heading", depth: 1, attrs: { level: 2 }, text: "## Quoted" },
    { id: "listed", type: "heading", depth: 2, attrs: { level: 3 }, text: "### Listed" },
    { id: "strings", type: "heading", depth: 0, attrs: { level: 2 }, text: "Strings\n---" },
  ];
  assert.deepEqual(documentOutline({ blocks }), [
    heading("title", 1, "Python Cheatsheet"), heading("types", 2, "Variables & Data Types"), heading("strings", 2, "Strings"),
  ]);
  assert.deepEqual(documentOutline({ blocks: [] }), []);
  assert.equal(documentOutline({}), null);
  assert.deepEqual(documentOutline({ blocks, outline: [] }), []);
});

test("raw heading labels keep code and escaped syntax and never turn source into markup", () => {
  const label = (text) => documentOutline({ blocks: [{ id: "a", type: "heading", depth: 0, attrs: { level: 1 }, text }] })[0].text;
  assert.equal(label('# **Core** [Docs](https://example.com) <span>*inside*</span>'), "Core Docs inside");
  assert.equal(label('# before![alt](one.png)<img src="two.png">[^note]<!--hidden-->after'), "beforeafter");
  assert.equal(label('# `**literal**` snake_case \\*escaped\\* &#x1f600;'), "**literal** snake_case *escaped* 😀");
});

test("outline tree handles skipped levels, repeated titles and multiple roots", () => {
  const tree = outlineTree([
    heading("a", 2, "Repeated"), heading("b", 5), heading("c", 3),
    heading("d", 1, "Repeated"), heading("e", 6),
  ]);
  assert.equal(tree.payload.label, "Outline");
  assert.deepEqual(tree.children.map((node) => node.payload.blockId), ["a", "d"]);
  assert.deepEqual(tree.children[0].children.map((node) => node.payload.blockId), ["b", "c"]);
  assert.equal(tree.children[1].children[0].payload.blockId, "e");
  assert.equal(outlineTree([]), null);
  assert.equal(outlineTree([heading("a", 3)]).payload.blockId, "a");
});

test("labels and block ids cannot inject HTML, links, images or event handlers", () => {
  const tree = outlineTree([heading('id" onclick="evil()', 1, '<img src=x onerror="evil()"> & <script>evil()</script>')]);
  assert.ok(!tree.content.includes("<img"));
  assert.ok(!tree.content.includes("<script"));
  assert.match(tree.content, /&lt;img/);
  assert.match(tree.content, /data-block-id="id&quot; onclick=&quot;evil\(\)"/);
  assert.match(outlineTree([heading("empty", 1, "")]).content, />Untitled<\/button>/);
});

test("folds survive renamed and reordered headings through stable block ids", () => {
  const old = outlineTree([heading("a", 1), heading("b", 2), heading("c", 3)]);
  old.children[0].payload.fold = 1;
  const next = outlineTree([heading("a", 1), heading("new", 2), heading("b", 2, "Renamed"), heading("c", 3)], collectFolds(old));
  assert.equal(next.children[0].payload.fold, 0);
  assert.equal(next.children[1].payload.fold, 1);
  assert.match(next.children[1].content, /Renamed/);
});
