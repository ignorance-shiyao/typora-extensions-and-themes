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

const HIGHLIGHT_LIMIT = 300000;
let paintTimer = 0;

// Colours are skipped above HIGHLIGHT_LIMIT characters; larger files are repainted after typing pauses.
function paint() {
  const text = ta.value;
  $("hl").innerHTML = globalThis.codeHighlight.highlight(text.length > HIGHLIGHT_LIMIT ? "" : ext, text) + "\n";
}

function refresh(typing) {
  const text = ta.value;
  clearTimeout(paintTimer);
  if (typing === true && text.length > 50000) paintTimer = setTimeout(paint, 150);
  else paint();
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

ta.addEventListener("input", () => refresh(true));
ta.addEventListener("scroll", syncScroll);
ta.addEventListener("keydown", (ev) => {
  if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "s") {
    ev.preventDefault();
    save();
  } else if (ev.key === "Tab" && !readonly) {
    ev.preventDefault();
    const { selectionStart: s, selectionEnd: e2, value } = ta;
    ta.value = value.slice(0, s) + "  " + value.slice(e2);
    ta.selectionStart = ta.selectionEnd = s + 2;
    refresh();
  }
});
$("save").addEventListener("click", save);
$("m-src").addEventListener("click", () => mode("src"));
$("m-view").addEventListener("click", () => mode("view"));
