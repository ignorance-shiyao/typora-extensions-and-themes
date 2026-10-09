// Kanban — an interactive fence renderer (docs/extensions.md §6.3): one
// sandboxed frame per fence, sized to its content; `snapshot` returns SVG
// for export and print.
//
//   ```kanban
//   ## Todo
//   - Write docs
//   ## Done
//   - [x] Ship it
//   ```

const view = window.typora.view;
let columns = [];

function parse(source) {
  const out = [];
  for (const raw of source.split("\n")) {
    const heading = /^\s*#{1,6}\s+(.*)$/.exec(raw);
    const card = /^\s*[-*+]\s+(?:\[([ xX])\]\s+)?(.*)$/.exec(raw);
    if (heading) out.push({ title: heading[1].trim(), cards: [] });
    else if (card) {
      if (!out.length) out.push({ title: "Cards", cards: [] });
      out[out.length - 1].cards.push({ text: card[2].trim(), done: !!card[1] && card[1] !== " " });
    }
  }
  return out;
}

function render() {
  const board = document.getElementById("board");
  board.replaceChildren();
  if (!columns.length) {
    board.innerHTML = '<div class="empty">Add “## Column” headings and “- card” items.</div>';
  }
  for (const column of columns) {
    const el = document.createElement("section");
    el.className = "column";
    const h = document.createElement("h3");
    h.textContent = column.title;
    const count = document.createElement("span");
    count.className = "count";
    count.textContent = String(column.cards.length);
    h.append(count);
    h.addEventListener("click", () => el.classList.toggle("collapsed"));
    const cards = document.createElement("div");
    cards.className = "cards";
    for (const card of column.cards) {
      const c = document.createElement("div");
      c.className = "card" + (card.done ? " done" : "");
      c.textContent = card.text;
      cards.append(c);
    }
    el.append(h, cards);
    board.append(el);
  }
}

view.onOpen(({ source }) => {
  columns = parse(source);
  render();
  view.autoHeight();
});

view.onSnapshot(() => {
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
  const width = 210, gap = 10, cardH = 30;
  const height = 40 + Math.max(1, ...columns.map((c) => c.cards.length)) * (cardH + 6) + 10;
  let svg = "";
  columns.forEach((column, i) => {
    const x = i * (width + gap);
    svg += `<rect x="${x}" y="0" width="${width}" height="${height}" rx="8" fill="#f4f5f7" stroke="#d0d7de"/>`;
    svg += `<text x="${x + 10}" y="22" font-size="12" font-weight="600" fill="#24292f">${esc(column.title.toUpperCase())} (${column.cards.length})</text>`;
    column.cards.forEach((card, j) => {
      const y = 36 + j * (cardH + 6);
      svg += `<rect x="${x + 8}" y="${y}" width="${width - 16}" height="${cardH}" rx="6" fill="#fff" stroke="#d0d7de"/>`;
      svg += `<text x="${x + 16}" y="${y + 19}" font-size="12" fill="#24292f"${card.done ? ' text-decoration="line-through" opacity="0.55"' : ""}>${esc(card.text.slice(0, 26))}</text>`;
    });
  });
  const total = Math.max(1, columns.length) * (width + gap);
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${height}" width="${total}" height="${height}" font-family="-apple-system, Segoe UI, sans-serif">${svg}</svg>` };
});
