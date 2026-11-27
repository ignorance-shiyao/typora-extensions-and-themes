#!/usr/bin/env node
// Static review of the packages a pull request changes (CONTRIBUTING.md,
// "Automated checks"). Runs from the trusted checkout of the base branch and
// reads the pull request as data through STORE_ROOT:
//
//   STORE_ROOT=pr node trusted/scripts/pr-check.mjs --base <sha> --out results [--online]
//   node scripts/pr-check.mjs --all [--online]          every package (nightly)
//   node scripts/pr-check.mjs typora.foo [--online]     these packages
//
// Writes <out>/static.json (scripts/review/findings.mjs), annotations and the
// job summary; `ids` and `tooling` go to $GITHUB_OUTPUT for the next jobs.
// Exit code 1 when anything is an error.

import { appendFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MANIFEST,
  git,
  normalizePermissions,
  packageDir,
  packageFiles,
  packageIds,
  packagePath,
  readManifest,
  vendorStatus,
} from "./lib.mjs";
import { checkCode } from "./review/code.mjs";
import { checkFiles, checkLocalization } from "./review/files.mjs";
import { Findings, annotate, printFindings, readWaivers, writeJson } from "./review/findings.mjs";
import { checkPatterns } from "./review/regex.mjs";
import { checkTheme } from "./review/theme.mjs";
import { osvCheck, verifyPackage } from "./review/vendor.mjs";

/** Where these scripts live: the base branch in CI, never the pull request. */
const TRUSTED_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGE_PATH = /^(extensions|themes)\/([^/]+)\//;

function parseArgs(argv) {
  const out = { base: null, out: null, online: false, all: false, ids: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--base") out.base = argv[++i];
    else if (a === "--out") out.out = argv[++i];
    else if (a === "--online") out.online = true;
    else if (a === "--all") out.all = true;
    else out.ids.push(a);
  }
  return out;
}

/** Paths changed against `base` (committed, uncommitted and untracked). */
export function changedPaths(base) {
  const lines = [
    ...git(["diff", "--name-only", base, "--"]).split("\n"),
    ...git(["ls-files", "--others", "--exclude-standard"]).split("\n"),
  ];
  return [...new Set(lines.filter(Boolean))].sort();
}

/** Split changed paths into package ids and everything else (the tooling). */
export function classify(paths) {
  const ids = new Set();
  const tooling = [];
  for (const path of paths) {
    const m = PACKAGE_PATH.exec(path);
    if (m && !(m[1] === "themes" && m[2] === "built-in")) ids.add(m[2]);
    else tooling.push(path);
  }
  return { ids: [...ids].sort(), tooling };
}

/** Permission keys the package has now and did not have at `base`. */
function addedPermissions(id, base) {
  if (!base) return [];
  let old = {};
  try {
    old = normalizePermissions(JSON.parse(git(["show", `${base}:${packagePath(id)}/${MANIFEST}`])).permissions);
  } catch {
    // New package: everything it asks for is new, but nothing was widened.
    return [];
  }
  const now = normalizePermissions(readManifest(id).permissions);
  return Object.keys(now).filter((k) => JSON.stringify(now[k]) !== JSON.stringify(old[k]));
}

export function checkPackage(id, findings, { base } = {}) {
  const dir = packageDir(id);
  let manifest;
  try {
    manifest = readManifest(id);
  } catch {
    return; // validate.mjs reports an unreadable manifest.
  }
  const files = packageFiles(dir);
  const { vendored } = vendorStatus(dir);
  const context = { id, dir, manifest, files, vendored, findings };
  checkFiles(context);
  checkCode({ ...context, added: addedPermissions(id, base) });
  checkPatterns(context);
  checkLocalization(context);
  checkTheme(context);
}

function summary(result) {
  const { ids, tooling, findings } = result;
  const count = (level) => findings.filter((f) => f.level === level).length;
  let md = `## Static review\n\n`;
  md += ids.length ? `Packages: ${ids.map((id) => `\`${id}\``).join(", ")}\n\n` : "No package changed.\n\n";
  if (tooling.length) md += `Tooling changed: ${tooling.map((p) => `\`${p}\``).join(", ")}\n\n`;
  md += `| error | review | warn | info |\n| --- | --- | --- | --- |\n| ${count("error")} | ${count("review")} | ${count("warn")} | ${count("info")} |\n\n`;
  const shown = findings.filter((f) => f.level !== "info");
  if (shown.length) {
    md += "| Level | Rule | Package | Where | Finding |\n| --- | --- | --- | --- | --- |\n";
    const cell = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
    for (const f of shown)
      md += `| ${f.level} | \`${f.rule}\` | \`${f.id ?? ""}\` | ${cell(f.file ? `${f.file}${f.line ? `:${f.line}` : ""}` : "")} | ${cell(f.message)} |\n`;
  }
  return md;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let ids = args.ids;
  let tooling = [];
  let removed = [];
  if (args.all) ids = packageIds();
  else if (args.base) {
    const changed = classify(changedPaths(args.base));
    tooling = changed.tooling;
    ids = changed.ids.filter((id) => packageIds().includes(id));
    removed = changed.ids.filter((id) => !packageIds().includes(id));
  }
  if (!ids.length && !args.all && !args.base) {
    console.error("Usage: pr-check.mjs --base <ref> | --all | <id>…  [--out dir] [--online]");
    process.exit(2);
  }

  const findings = new Findings();
  for (const id of ids) checkPackage(id, findings, { base: args.base });
  if (args.online) {
    for (const id of ids) await verifyPackage(id, findings);
    try {
      await osvCheck(ids, findings);
    } catch (error) {
      findings.warn("vendor/osv", null, `Could not query osv.dev: ${error.message}`);
    }
  }
  findings.applyWaivers(readWaivers(TRUSTED_ROOT));

  const packages = Object.fromEntries(ids.map((id) => [id, packagePath(id)]));
  const result = { base: args.base, ids, removed, tooling, packages, findings: findings.items };
  if (args.out) writeJson(join(args.out, "static.json"), result);
  printFindings(findings.items.filter((f) => f.level !== "info"));
  annotate(findings.items, (id) => (existsSync(packageDir(id)) ? packagePath(id) : id));
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary(result)}\n`);
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, `ids=${ids.join(" ")}\ntooling=${tooling.length ? "true" : "false"}\n`);
  console.log(`\n${ids.length} package(s): ${findings.count("error")} error(s), ${findings.count("review")} for review, ${findings.count("warn")} warning(s).`);
  process.exit(findings.count("error") ? 1 : 0);
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  main().catch((error) => {
    console.error(error.stack ?? error.message);
    process.exit(2);
  });
