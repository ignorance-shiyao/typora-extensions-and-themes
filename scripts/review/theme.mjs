// Themes (CONTRIBUTING.md, "Contributing a theme"): text stays readable in
// every color scheme the theme offers. The colors come from theme.toml's
// [vars] (and [vars.light] / [vars.dark]), the same values Typora applies, so
// no renderer is needed. WCAG 2 contrast: 4.5:1 for body text, 3:1 for
// headings and other large or secondary text.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { themeHead } from "../lib.mjs";

/** The [vars], [vars.light] and [vars.dark] tables of a theme.toml (strings and numbers). */
export function themeVars(text) {
  const tables = {};
  let current = null;
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\s+#.*$/, "").trim();
    const header = /^\[([^\]]+)\]$/.exec(line);
    if (header) {
      current = header[1].trim();
      tables[current] ??= {};
      continue;
    }
    if (/^\[\[/.test(line)) {
      current = null;
      continue;
    }
    const pair = /^([A-Za-z0-9_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s]+))$/.exec(line);
    if (pair && current) tables[current][pair[1]] = pair[2] ?? pair[3] ?? pair[4];
  }
  return tables;
}

const NAMED = { white: [255, 255, 255], black: [0, 0, 0], transparent: null };

/** [r, g, b, a] from a CSS color, or null for what it cannot read. */
export function parseColor(value) {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  if (v in NAMED) return NAMED[v] ? [...NAMED[v], 1] : null;
  let m = /^#([0-9a-f]{3,8})$/.exec(v);
  if (m) {
    let hex = m[1];
    if (hex.length === 3 || hex.length === 4) hex = [...hex].map((c) => c + c).join("");
    if (hex.length !== 6 && hex.length !== 8) return null;
    const n = (i) => parseInt(hex.slice(i, i + 2), 16);
    return [n(0), n(2), n(4), hex.length === 8 ? n(6) / 255 : 1];
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(v);
  if (m) {
    const a = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return [Number(m[1]), Number(m[2]), Number(m[3]), a];
  }
  return null;
}

const luminance = ([r, g, b]) => {
  const c = [r, g, b].map((x) => {
    const s = x / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};

/** Contrast of `fg` over `bg` (a translucent foreground is blended first). */
export function contrast(fg, bg) {
  const blended = fg.slice(0, 3).map((x, i) => x * fg[3] + bg[i] * (1 - fg[3]));
  const [a, b] = [luminance(blended), luminance(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

/** [variable, minimum, level when below]. */
const PAIRS = [
  ["text", 4.5, "error"],
  ["heading", 3, "error"],
  ["link", 3, "warn"],
  ["muted", 3, "warn"],
];

export function checkTheme({ id, dir, manifest, findings }) {
  for (const folder of manifest.contributes?.themes ?? []) {
    const tomlPath = join(dir, folder, "theme.toml");
    if (!existsSync(tomlPath)) continue;
    const text = readFileSync(tomlPath, "utf8");
    const head = themeHead(tomlPath);
    const tables = themeVars(text);
    const scheme = head.colorScheme;
    const schemes = scheme === "auto" ? ["light", "dark"] : [scheme];
    for (const s of schemes) {
      const vars = { ...tables.vars, ...tables[`vars.${s}`] };
      const bg = parseColor(vars.bg);
      if (!bg || bg[3] < 1) continue;
      for (const [name, min, level] of PAIRS) {
        const fg = parseColor(vars[name]);
        if (!fg) continue;
        const ratio = contrast(fg, bg);
        if (ratio < min)
          findings.add(level, "theme/contrast", id, `${s}: ${name} ${vars[name]} on ${vars.bg} has a contrast of ${ratio.toFixed(2)}:1 (at least ${min}:1).`, { file: `${folder}/theme.toml` });
      }
    }
  }
}
