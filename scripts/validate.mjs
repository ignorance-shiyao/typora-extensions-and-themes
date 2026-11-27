#!/usr/bin/env node
// Validate every extensions/<id>/ and themes/<id>/ folder. Exit code 1 on any
// error.
//
//   node scripts/validate.mjs            all of them
//   node scripts/validate.mjs typora.foo only these

import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  EXTENSIONS_DIR,
  MANIFEST,
  MAX_DICTIONARY_FILE_BYTES,
  MAX_FILE_BYTES,
  MAX_LANGUAGE_PACK_BYTES,
  MAX_MATH_FONT_FILE_BYTES,
  MAX_PACKAGE_BYTES,
  STORE_IMAGE_PATTERN,
  STORE_IMAGE_RATIOS,
  STORE_IMAGE_WARN_BYTES,
  ROOT,
  THEME_IMAGE_RATIOS,
  THEMES_DIR,
  checkManifest,
  checkSuggestions,
  checkThemePackage,
  dictionaryFiles,
  mathFontFolders,
  hiddenFiles,
  imageSize,
  packageDir,
  packageIds,
  packagePath,
  STORE_META,
  themeIds,
  vendorStatus,
} from "./lib.mjs";

const CI = !!process.env.GITHUB_ACTIONS;
const annotate = (level, file, message) =>
  CI ? console.log(`::${level} file=${file}::${message.replace(/\n/g, " ")}`) : null;

/** Source checks (§8.6): no eval of fetched content, no remote code, no minified sources. */
const CODE_RULES = [
  { re: /\beval\s*\(/, message: "uses eval(" },
  { re: /\bnew\s+Function\s*\(/, message: "uses new Function(" },
  { re: /\bimportScripts\s*\(\s*["'`]https?:/, message: "loads remote code with importScripts()" },
  { re: /\bimport\s*\(\s*["'`]https?:/, message: "loads remote code with import()" },
  { re: /\bimport\s+[^;]*?from\s+["'`]https?:/, message: "imports a module from a URL" },
];
const HTML_RULES = [
  { re: /<script[^>]+src\s*=\s*["']?(https?:)?\/\//i, message: "loads a remote <script>" },
  { re: /<link[^>]+href\s*=\s*["']?(https?:)?\/\/[^>]*stylesheet|<link[^>]+stylesheet[^>]*href\s*=\s*["']?(https?:)?\/\//i, message: "loads a remote stylesheet" },
];
const MINIFIED_LINE = 1000;

function walkAll(dir, rel = "", out = []) {
  for (const entry of readdirSync(join(dir, rel), { withFileTypes: true })) {
    const path = rel ? `${rel}/${entry.name}` : entry.name;
    out.push(path);
    if (entry.isDirectory()) walkAll(dir, path, out);
  }
  return out;
}

function validate(id) {
  const dir = packageDir(id);
  const isTheme = themeIds().includes(id);
  const ratios = isTheme ? THEME_IMAGE_RATIOS : STORE_IMAGE_RATIOS;
  const errors = [];
  const warnings = [];
  const where = new Map(); // message → file for annotations

  if (!lstatSync(dir).isDirectory()) return { errors: [`${packagePath(id)} is not a folder.`], warnings, where };

  let manifestJson = null;
  try {
    manifestJson = JSON.parse(readFileSync(join(dir, MANIFEST), "utf8"));
  } catch {
    /* reported below */
  }
  const dictionaries = dictionaryFiles(manifestJson);
  const fontFolders = mathFontFolders(manifestJson);
  const inFontFolder = (path) => fontFolders.some((folder) => path.startsWith(`${folder}/`));
  // Registered, unchanged third-party files (.typora/vendor.json) are not
  // held to the source rules: their origin is checked instead.
  const vendor = vendorStatus(dir);
  errors.push(...vendor.problems);
  let total = 0;
  for (const path of walkAll(dir)) {
    const stat = lstatSync(join(dir, path));
    if (stat.isSymbolicLink()) {
      errors.push(`${path} is a symbolic link.`);
      continue;
    }
    if (!stat.isFile()) continue;
    if (path.split("/").some((part) => part.startsWith("."))) continue;
    // Store images don't count towards the total but have the same per-file limit.
    if (STORE_IMAGE_PATTERN.test(path)) {
      const kind = path.split(".")[0].toLowerCase();
      const size = imageSize(readFileSync(join(dir, path)));
      if (size && Math.abs(size.width / size.height - ratios[kind]) > 0.02)
        warnings.push(`${path} is ${size.width}×${size.height}; ${kind === "screenshot" ? "a screenshot is 16:10 (1760×1100)" : isTheme ? "a theme's cover is 5:4" : "a cover is 2:1 (800×400)"}.`);
      if (stat.size > STORE_IMAGE_WARN_BYTES)
        warnings.push(`${path} is ${(stat.size / 1024).toFixed(0)} KB; compress it (lossless WebP for screenshots) to stay under ${STORE_IMAGE_WARN_BYTES / 1024} KB.`);
    } else total += stat.size;
    const limit = dictionaries.has(path)
      ? MAX_DICTIONARY_FILE_BYTES
      : inFontFolder(path)
        ? MAX_MATH_FONT_FILE_BYTES
        : MAX_FILE_BYTES;
    if (stat.size > limit)
      errors.push(`${path} is ${(stat.size / 1024).toFixed(0)} KB (limit ${limit / 1024} KB).`);

    const isCode = /\.(m?js|cjs)$/i.test(path);
    const isHtml = /\.html?$/i.test(path);
    if ((!isCode && !isHtml) || vendor.vendored.has(path)) continue;
    const text = readFileSync(join(dir, path), "utf8");
    const lines = text.split("\n");
    const rules = isCode ? CODE_RULES : HTML_RULES;
    // HTML inline scripts get the code rules too.
    const all = isHtml ? [...rules, ...CODE_RULES] : rules;
    lines.forEach((line, i) => {
      for (const rule of all) {
        if (rule.re.test(line)) {
          const message = `${path}:${i + 1} ${rule.message}`;
          warnings.push(message);
          where.set(message, `${packagePath(id)}/${path},line=${i + 1}`);
        }
      }
    });
    const longest = lines.reduce((n, l) => Math.max(n, l.length), 0);
    // MathJax's font data is generated, one long line per table.
    if (longest > MINIFIED_LINE && !inFontFolder(path))
      warnings.push(`${path} has a ${longest}-character line; minified or generated sources are not accepted (§8.6).`);
  }
  const packageLimit = dictionaries.size || fontFolders.length ? MAX_LANGUAGE_PACK_BYTES : MAX_PACKAGE_BYTES;
  if (total > packageLimit)
    errors.push(`The package is ${(total / 1024 / 1024).toFixed(1)} MB (limit ${packageLimit / 1024 / 1024} MB).`);
  for (const path of hiddenFiles(dir)) if (path !== STORE_META) warnings.push(`${path} is hidden and will not be packaged.`);

  let raw;
  try {
    raw = JSON.parse(readFileSync(join(dir, MANIFEST), "utf8"));
  } catch (error) {
    errors.push(
      error.code === "ENOENT" ? `${MANIFEST} is missing.` : `${MANIFEST} is not valid JSON: ${error.message}`,
    );
    return { errors, warnings, where };
  }
  const result = checkManifest(raw, dir, id);
  errors.push(...result.errors);
  warnings.push(...result.warnings);
  if (isTheme) errors.push(...checkThemePackage(raw, dir));
  return { errors, warnings, where };
}

const wanted = process.argv.slice(2);
const ids = wanted.length ? wanted : packageIds();
let failed = 0;
let warned = 0;

for (const [root, folder] of [[EXTENSIONS_DIR, "extensions"], [THEMES_DIR, "themes"]]) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() && !entry.name.startsWith(".")) {
      console.log(`✗ ${folder}/${entry.name}: only package folders belong in ${folder}/.`);
      annotate("error", `${folder}/${entry.name}`, `Only package folders belong in ${folder}/.`);
      failed++;
    }
  }
}

for (const id of themeIds()) {
  if (existsSync(join(EXTENSIONS_DIR, id))) {
    console.log(`✗ ${id}: in both extensions/ and themes/; an id is unique across the store.`);
    annotate("error", `themes/${id}`, "This id is also in extensions/.");
    failed++;
  }
}

for (const id of ids) {
  const { errors, warnings, where } = validate(id);
  const mark = errors.length ? "✗" : warnings.length ? "!" : "✓";
  console.log(`${mark} ${id}`);
  for (const e of errors) {
    console.log(`    error: ${e}`);
    annotate("error", `${packagePath(id)}/${MANIFEST}`, `${id}: ${e}`);
  }
  for (const w of warnings) {
    console.log(`    warning: ${w}`);
    annotate("warning", where.get(w) ?? `${packagePath(id)}/${MANIFEST}`, `${id}: ${w}`);
  }
  if (errors.length) failed++;
  if (warnings.length) warned++;
}

for (const error of checkSuggestions(JSON.parse(readFileSync(join(ROOT, "suggestions.json"), "utf8")))) {
  console.log(`✗ suggestions.json: ${error}`);
  annotate("error", "suggestions.json", error);
  failed++;
}

console.log(
  `\n${ids.length} package(s): ${failed} with errors, ${warned} with warnings.`,
);
process.exit(failed ? 1 : 0);
