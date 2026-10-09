// Charts — a static fence renderer (docs/extensions.md §6.3): Typora sends
// the fence source, this returns SVG, Typora sanitizes and inlines it.
//
//   ```chart
//   type: bar | line | pie
//   title: Optional title
//   label, value[, value2 …]
//   ```

const PALETTE = ["#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f", "#edc948", "#b07aa1", "#ff9da7"];

function parse(source) {
  const options = { type: "bar", title: "" };
  const rows = [];
  for (const raw of source.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const option = /^(type|title|series)\s*:\s*(.*)$/i.exec(line);
    if (option) {
      options[option[1].toLowerCase()] = option[2].trim();
      continue;
    }
    const cells = line.split(/\s*[,\t|]\s*/);
    const values = cells.slice(1).map(Number);
    if (cells.length < 2 || values.some((v) => !Number.isFinite(v))) throw new Error(`Cannot read "${line}": expected "label, number".`);
    rows.push({ label: cells[0], values });
  }
  if (!rows.length) throw new Error("No data rows.");
  options.series = options.series ? options.series.split(/\s*,\s*/) : [];
  return { options, rows };
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function axisChart({ options, rows }, theme) {
  const W = 640, H = 360, L = 48, R = 16, T = options.title ? 40 : 16, B = 40;
  const series = Math.max(...rows.map((r) => r.values.length));
  const max = Math.max(0, ...rows.flatMap((r) => r.values));
  const min = Math.min(0, ...rows.flatMap((r) => r.values));
  const span = max - min || 1;
  const y = (v) => T + (H - T - B) * (1 - (v - min) / span);
  const slot = (W - L - R) / rows.length;
  const fg = theme.foreground;
  let out = "";
  for (let i = 0; i <= 4; i++) {
    const v = min + (span * i) / 4;
    out += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${theme.border}" stroke-width="1"/>`;
    out += `<text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="${fg}">${+v.toFixed(2)}</text>`;
  }
  rows.forEach((row, i) => {
    out += `<text x="${L + slot * (i + 0.5)}" y="${H - B + 16}" text-anchor="middle" font-size="11" fill="${fg}">${esc(row.label)}</text>`;
  });
  for (let s = 0; s < series; s++) {
    const color = PALETTE[s % PALETTE.length];
    if (options.type === "line") {
      const points = rows.map((row, i) => `${L + slot * (i + 0.5)},${y(row.values[s] ?? 0)}`).join(" ");
      out += `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="2"/>`;
      rows.forEach((row, i) => (out += `<circle cx="${L + slot * (i + 0.5)}" cy="${y(row.values[s] ?? 0)}" r="3" fill="${color}"/>`));
    } else {
      const bar = (slot * 0.7) / series;
      rows.forEach((row, i) => {
        const v = row.values[s] ?? 0;
        const x = L + slot * i + slot * 0.15 + bar * s;
        out += `<rect x="${x}" y="${Math.min(y(v), y(0))}" width="${bar}" height="${Math.abs(y(v) - y(0))}" fill="${color}"><title>${esc(row.label)}: ${v}</title></rect>`;
      });
    }
  }
  if (options.series.length) {
    options.series.forEach((name, s) => {
      out += `<rect x="${W - R - 110}" y="${T + s * 16}" width="10" height="10" fill="${PALETTE[s % PALETTE.length]}"/>`;
      out += `<text x="${W - R - 95}" y="${T + s * 16 + 9}" font-size="11" fill="${fg}">${esc(name)}</text>`;
    });
  }
  return frame(W, H, options.title, theme, out);
}

function pieChart({ options, rows }, theme) {
  const W = 480, H = 320, cx = 160, cy = options.title ? 180 : 160, r = 120;
  const total = rows.reduce((sum, row) => sum + Math.max(0, row.values[0]), 0) || 1;
  let angle = -Math.PI / 2;
  let out = "";
  rows.forEach((row, i) => {
    const value = Math.max(0, row.values[0]);
    const sweep = (value / total) * Math.PI * 2;
    const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
    angle += sweep;
    const x2 = cx + r * Math.cos(angle), y2 = cy + r * Math.sin(angle);
    const color = PALETTE[i % PALETTE.length];
    out += `<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x2},${y2} Z" fill="${color}"><title>${esc(row.label)}: ${value}</title></path>`;
    out += `<rect x="310" y="${60 + i * 20}" width="12" height="12" fill="${color}"/>`;
    out += `<text x="328" y="${71 + i * 20}" font-size="12" fill="${theme.foreground}">${esc(row.label)} (${Math.round((value / total) * 100)}%)</text>`;
  });
  return frame(W, H, options.title, theme, out);
}

function frame(W, H, title, theme, body) {
  const heading = title ? `<text x="${W / 2}" y="24" text-anchor="middle" font-size="15" font-weight="600" fill="${theme.foreground}">${esc(title)}</text>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="-apple-system, Segoe UI, sans-serif">${heading}${body}</svg>`;
}

window.typora.view.onRender(({ source, theme }) => {
  const chart = parse(source);
  return { svg: chart.options.type === "pie" ? pieChart(chart, theme) : axisChart(chart, theme) };
});
