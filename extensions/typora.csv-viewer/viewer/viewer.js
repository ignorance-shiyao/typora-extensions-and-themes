// CSV Viewer page (L1, sandboxed; docs/extensions.md §6.2).
const view = window.typora.view;
let rows = [];
let delimiter = ",";
let readonly = true;
let sort = { column: -1, dir: 1 };

/** RFC 4180-ish parser: quotes, escaped quotes, newlines inside quotes. */
function parse(text, sep) {
  const out = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === sep) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      out.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    out.push(row);
  }
  return out;
}

function serialize(data, sep) {
  const quote = (value) => (/["\n\r]/.test(value) || value.includes(sep) ? `"${value.replace(/"/g, '""')}"` : value);
  return data.map((row) => row.map(quote).join(sep)).join("\n") + "\n";
}

function toMarkdown(data) {
  const width = Math.max(...data.map((r) => r.length));
  const cell = (value) => String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, "<br>");
  const line = (row) => `| ${Array.from({ length: width }, (_, i) => cell(row[i])).join(" | ")} |`;
  const [head = [], ...body] = data;
  return [line(head), `| ${Array(width).fill("---").join(" | ")} |`, ...body.map(line)].join("\n");
}

function render() {
  const table = document.getElementById("table");
  table.replaceChildren();
  if (!rows.length) return;
  const [head, ...body] = rows;
  const order = body.map((_, i) => i);
  if (sort.column >= 0) {
    const numeric = body.every((r) => r[sort.column] === "" || !isNaN(Number(r[sort.column])));
    order.sort((a, b) => {
      const x = body[a][sort.column] ?? "";
      const y = body[b][sort.column] ?? "";
      return sort.dir * (numeric ? Number(x) - Number(y) : x.localeCompare(y));
    });
  }
  const thead = table.createTHead().insertRow();
  thead.appendChild(document.createElement("th")).textContent = "#";
  head.forEach((title, column) => {
    const th = document.createElement("th");
    th.textContent = title;
    if (sort.column === column) th.dataset.sort = sort.dir > 0 ? "asc" : "desc";
    th.addEventListener("click", () => {
      sort = sort.column === column ? { column, dir: -sort.dir } : { column, dir: 1 };
      render();
    });
    thead.appendChild(th);
  });
  const tbody = table.createTBody();
  for (const index of order) {
    const tr = tbody.insertRow();
    const number = tr.insertCell();
    number.className = "row-number";
    number.textContent = String(index + 1);
    head.forEach((_, column) => {
      const td = tr.insertCell();
      td.textContent = body[index][column] ?? "";
      if (!readonly) {
        td.contentEditable = "plaintext-only";
        td.addEventListener("input", () => {
          body[index][column] = td.textContent;
          dirty(true);
        });
      }
    });
  }
  document.getElementById("info").textContent = `${body.length} rows × ${head.length} columns`;
}

function dirty(value) {
  document.getElementById("save").disabled = !value;
  view.setDirty(value);
}

view.onOpen(({ name, bytes, readonly: ro, ext }) => {
  readonly = ro;
  delimiter = ext === "tsv" ? "\t" : ",";
  document.getElementById("name").textContent = name;
  document.getElementById("add-row").hidden = ro;
  document.getElementById("save").hidden = ro;
  rows = parse(new TextDecoder().decode(bytes).replace(/^﻿/, ""), delimiter);
  dirty(false);
  render();
});

document.getElementById("copy").addEventListener("click", () => {
  view.postMessage({ type: "copyMarkdown", markdown: toMarkdown(rows), rows: Math.max(0, rows.length - 1) });
});
document.getElementById("add-row").addEventListener("click", () => {
  rows.push(Array((rows[0] ?? [""]).length).fill(""));
  dirty(true);
  render();
});
document.getElementById("save").addEventListener("click", async () => {
  await view.save(serialize(rows, delimiter));
  dirty(false);
});
