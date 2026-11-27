// Code viewer page (L1, sandboxed): source with line numbers, syntax colours (highlight.js) and plain
// editing; HTML files also get a sandboxed preview of the current buffer.
const view = window.typora.view;
const $ = (id) => document.getElementById(id);
const ta = $("ta");
let ext = "";
let saved = "";
let readonly = true;

function showSize(size) {
  $("info").textContent = size > 1024 ? `${(size / 1024).toFixed(1)} KB` : `${size} B`;
}

function paint() {
  $("hl").innerHTML = globalThis.codeHighlight.highlight(ext, ta.value) + "\n";
}

function refresh() {
  const text = ta.value;
  paint();
  const lines = text.split("\n").length;
  $("gutter").textContent = Array.from({ length: lines }, (_, i) => i + 1).join("\n");
  const isDirty = text !== saved;
  $("dirty").hidden = !isDirty;
  $("save").disabled = !isDirty || readonly;
  view.setDirty(isDirty);
}

function syncScroll() {
  $("hl").scrollTop = ta.scrollTop;
  $("hl").scrollLeft = ta.scrollLeft;
  $("gutter").scrollTop = ta.scrollTop;
}

async function save() {
  if (readonly || ta.value === saved) return;
  await view.save(ta.value);
  saved = ta.value;
  showSize(new TextEncoder().encode(saved).length);
  refresh();
}

function mode(name) {
  const src = name === "src";
  $("editor").hidden = !src;
  $("preview").hidden = src;
  $("m-src").setAttribute("aria-pressed", String(src));
  $("m-view").setAttribute("aria-pressed", String(!src));
  if (!src) $("preview").srcdoc = ta.value;
}

view.onOpen(({ name, bytes, ext: e, size, readonly: ro }) => {
  ext = e;
  readonly = ro;
  saved = new TextDecoder().decode(bytes).replace(/^﻿/, "");
  ta.value = saved;
  ta.readOnly = ro;
  $("name").textContent = name;
  showSize(size);
  $("save").hidden = ro;
  $("modes").hidden = !(e === "html" || e === "htm");
  refresh();
  mode("src");
});

// Edits go through execCommand so the browser keeps its undo history; assigning ta.value would clear it.
function replaceRange(start, end, text, selStart, selEnd) {
  ta.focus();
  ta.setSelectionRange(start, end);
  document.execCommand("insertText", false, text);
  ta.setSelectionRange(selStart, selEnd);
}

function indent(outdent) {
  const { selectionStart: s, selectionEnd: e, value } = ta;
  if (s === e && !outdent) return replaceRange(s, e, "  ", s + 2, s + 2);
  const from = value.lastIndexOf("\n", s - 1) + 1;
  const to = e > s && value[e - 1] === "\n" ? e - 1 : e;
  const lines = value.slice(from, to).split("\n");
  const out = lines.map((line) => (outdent ? line.replace(/^(?: {1,2}|\t)/, "") : "  " + line));
  const text = out.join("\n");
  const first = out[0].length - lines[0].length;
  replaceRange(from, to, text, Math.max(from, s + first), to + text.length - (to - from));
}

ta.addEventListener("input", refresh);
ta.addEventListener("scroll", syncScroll);
ta.addEventListener("keydown", (ev) => {
  if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "s") {
    ev.preventDefault();
    save();
  } else if (ev.key === "Tab" && !readonly) {
    ev.preventDefault();
    indent(ev.shiftKey);
  }
});
$("save").addEventListener("click", save);
$("m-src").addEventListener("click", () => mode("src"));
$("m-view").addEventListener("click", () => mode("view"));
