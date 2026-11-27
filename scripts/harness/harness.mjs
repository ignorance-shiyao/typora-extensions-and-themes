#!/usr/bin/env node
// Run packages in Typora's sandbox, headless (CONTRIBUTING.md, "Automated
// checks"): main and background activate and deactivate, the commands the
// manifest lists get registered, every page loads, fence renderers draw
// their examples into SVG Typora accepts and survive untrusted input. No
// network and no programs: requests and spawns are recorded instead.
//
//   STORE_ROOT=pr node trusted/scripts/harness/harness.mjs --out results [--browsers chromium,webkit] id…
//   node scripts/harness/harness.mjs --all
//
// Writes <out>/runtime.json and <out>/screens/*.png. Exit code 1 on errors.

import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { STORE_META, normalizePermissions, packageDir, packageIds, packagePath, readManifest } from "../lib.mjs";
import { annotate, printFindings, writeJson } from "../review/findings.mjs";
import { startServer } from "./server.mjs";

const BROWSERS = { chromium, webkit };

function parseArgs(argv) {
  const out = { ids: [], out: null, all: false, browsers: ["chromium", "webkit"] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") out.out = argv[++i];
    else if (a === "--all") out.all = true;
    else if (a === "--browsers") out.browsers = argv[++i].split(",").filter(Boolean);
    else out.ids.push(...a.split(/\s+/).filter(Boolean));
  }
  return out;
}

/** Fenced code blocks of a Markdown file: [{ lang, source }]. */
export function fences(text) {
  const out = [];
  for (const m of text.matchAll(/^(`{3,}|~{3,})[ \t]*([^\s`]*)[^\n]*\n([\s\S]*?)\n\1[ \t]*$/gm)) out.push({ lang: m[2].toLowerCase(), source: m[3] });
  return out;
}

/** A snippet's text as inserted: {{1:Author}} and ${1:Author} become Author. */
export const expandSnippet = (text) => text.replace(/\{\{\d+(?::([^}]*))?\}\}|\$\{\d+(?::([^}]*))?\}/g, (_, a, b) => a ?? b ?? "");

/** Examples to render: the package's snippets and .typora/fixtures/. */
function fixtures(dir, manifest) {
  const out = [];
  const folders = [join(dir, STORE_META, "fixtures")];
  if (typeof manifest.contributes?.snippets === "string") folders.push(join(dir, manifest.contributes.snippets));
  for (const folder of folders) {
    if (!existsSync(folder)) continue;
    for (const name of readdirSync(folder).filter((n) => n.endsWith(".md"))) {
      const rel = `${folder.slice(dir.length + 1)}/${name}`;
      fences(expandSnippet(readFileSync(join(folder, name), "utf8"))).forEach((f, i) => out.push({ ...f, file: rel, index: i + 1 }));
    }
  }
  return out;
}

/** What host.js needs to know about a package. */
function describe(id) {
  const dir = packageDir(id);
  const manifest = readManifest(id);
  const c = manifest.contributes ?? {};
  const settings = {};
  for (const [key, prop] of Object.entries(c.configuration?.properties ?? {})) if (prop && "default" in prop) settings[key] = prop.default;
  return {
    id,
    name: manifest.name,
    version: manifest.version,
    main: manifest.main ?? null,
    background: manifest.background ?? null,
    permissions: normalizePermissions(manifest.permissions),
    settings,
    commands: (c.commands ?? []).map((cmd) => (typeof cmd === "string" ? cmd : cmd?.id)).filter(Boolean),
    fenceRenderers: (c.fenceRenderers ?? []).filter((r) => typeof r?.entry === "string" && !r.kroki),
    views: [
      ...(c.detailViews ?? []).filter((v) => typeof v?.entry === "string").map((v) => ({ entry: v.entry, kind: "detail" })),
      ...(c.fileViewers ?? []).filter((v) => typeof v?.entry === "string").map((v) => ({ entry: v.entry, kind: "file" })),
    ],
    fixtures: fixtures(dir, manifest),
  };
}

const runnable = (p) => p.main || p.background || p.fenceRenderers.length || p.views.length;

async function runOne(browser, origin, pkg, out, name) {
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  try {
    await page.goto(`${origin}/app/host.html`);
    await page.waitForFunction(() => window.hostReady === true && typeof window.runPackage === "function");
    const record = await page.evaluate((p) => window.runPackage(p), pkg);
    for (const text of consoleErrors) {
      // A CSP refusal means something the extension needs never loads.
      if (/Refused to|Content Security Policy/i.test(text)) record.findings.push({ level: "error", rule: "runtime/csp", message: text.slice(0, 300) });
      else record.findings.push({ level: "warn", rule: "runtime/console", message: text.slice(0, 300) });
    }
    if (out && (record.pages || record.renders)) {
      mkdirSync(join(out, "screens"), { recursive: true });
      await page.screenshot({ path: join(out, "screens", `${name}-${pkg.id}.png`), fullPage: true });
    }
    return record;
  } finally {
    await page.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const ids = (args.all ? packageIds() : args.ids).filter((id) => packageIds().includes(id));
  const pkgs = ids.map(describe).filter(runnable);
  const results = new Map(pkgs.map((p) => [p.id, { id: p.id, findings: [], requests: new Set(), programs: new Set() }]));
  const server = await startServer(pkgs.map((p) => p.id));
  try {
    for (const name of args.browsers) {
      const browser = await BROWSERS[name].launch({ headless: true });
      try {
        for (const pkg of pkgs) {
          console.log(`… ${name} ${pkg.id}`);
          const record = await runOne(browser, server.origin, pkg, args.out, name).catch((error) => ({
            findings: [{ level: "error", rule: "runtime/harness", message: error.message.split("\n")[0] }],
          }));
          const r = results.get(pkg.id);
          for (const f of record.findings ?? []) {
            const message = `${f.message} (${name})`;
            if (!r.findings.some((g) => g.rule === f.rule && g.message.replace(/ \(\w+\)$/, "") === f.message)) r.findings.push({ ...f, message });
          }
          for (const q of record.requests ?? []) r.requests.add(q);
          for (const q of record.programs ?? []) r.programs.add(q);
          if (record.activated !== undefined) r.activated = (r.activated ?? true) && record.activated;
          r.pages = Math.max(r.pages ?? 0, record.pages ?? 0);
          r.renders = Math.max(r.renders ?? 0, record.renders ?? 0);
        }
      } finally {
        await browser.close();
      }
    }
  } finally {
    server.close();
  }

  const findings = [];
  for (const r of results.values()) {
    for (const f of r.findings) findings.push({ rule: f.rule, level: f.level, id: r.id, file: f.file ?? null, line: null, message: f.message });
    for (const q of r.requests) findings.push({ rule: "runtime/request", level: "info", id: r.id, file: null, line: null, message: q });
    for (const q of r.programs) findings.push({ rule: "runtime/program", level: "info", id: r.id, file: null, line: null, message: q });
  }
  const packages = [...results.values()].map((r) => ({
    id: r.id, activated: r.activated, pages: r.pages, renders: r.renders, requests: [...r.requests], programs: [...r.programs],
  }));
  if (args.out) writeJson(join(args.out, "runtime.json"), { browsers: args.browsers, packages, findings });
  printFindings(findings.filter((f) => f.level !== "info"));
  annotate(findings, packagePath);
  const errors = findings.filter((f) => f.level === "error").length;
  if (process.env.GITHUB_STEP_SUMMARY) {
    let md = `## In the sandbox (${args.browsers.join(", ")})\n\n| Package | Activates | Pages | Renders | Requests | Programs |\n| --- | --- | --- | --- | --- | --- |\n`;
    for (const p of packages)
      md += `| \`${p.id}\` | ${p.activated === undefined ? "—" : p.activated ? "yes" : "**no**"} | ${p.pages} | ${p.renders} | ${p.requests.length} | ${p.programs.length} |\n`;
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${md}\n`);
  }
  console.log(`\n${packages.length} package(s) run: ${errors} error(s).`);
  process.exit(errors ? 1 : 0);
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  main().catch((error) => {
    console.error(error.stack ?? error.message);
    process.exit(2);
  });
