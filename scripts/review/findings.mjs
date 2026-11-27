// One shape for every check's result, so one reporter turns them into
// annotations, the job summary, the pull request comment and the review
// policy (CONTRIBUTING.md, "Automated checks").
//
//   { rule, level, id, file, line, message }
//
// level:
//   error   blocks the merge (fix it, or a maintainer waives it in review/waivers.json)
//   review  a reviewer must look at it; raises the risk (scripts/review/risk.mjs)
//   warn    advice for the author
//   info    context for the reviewer (permission table, recorded requests, …)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ROOT } from "../lib.mjs";

export const LEVELS = ["error", "review", "warn", "info"];

export class Findings {
  constructor() {
    this.items = [];
  }

  add(level, rule, id, message, { file, line } = {}) {
    if (!LEVELS.includes(level)) throw new Error(`Unknown level ${level}`);
    this.items.push({ rule, level, id: id ?? null, file: file ?? null, line: line ?? null, message });
  }

  error(rule, id, message, at) {
    this.add("error", rule, id, message, at);
  }
  review(rule, id, message, at) {
    this.add("review", rule, id, message, at);
  }
  warn(rule, id, message, at) {
    this.add("warn", rule, id, message, at);
  }
  info(rule, id, message, at) {
    this.add("info", rule, id, message, at);
  }

  count(level) {
    return this.items.filter((f) => f.level === level).length;
  }

  /** Errors a maintainer waived become `info`, with the reason. */
  applyWaivers(waivers) {
    for (const item of this.items) {
      if (item.level !== "error" && item.level !== "review") continue;
      const waiver = waivers.find(
        (w) => w.id === item.id && w.rule === item.rule && (w.file === undefined || w.file === item.file),
      );
      if (!waiver) continue;
      item.waived = { from: item.level, reason: waiver.reason };
      item.level = "info";
    }
  }
}

/** review/waivers.json: [{ id, rule, file?, reason }]. Only maintainers edit it (CODEOWNERS). */
export function readWaivers(root = ROOT) {
  const path = join(root, "review", "waivers.json");
  if (!existsSync(path)) return [];
  const raw = JSON.parse(readFileSync(path, "utf8"));
  return Array.isArray(raw.waivers) ? raw.waivers : [];
}

/** Where an item points, as the package-relative path the annotation needs. */
export function annotationFile(item, packagePathOf) {
  if (!item.id) return item.file ?? "";
  const base = packagePathOf(item.id);
  return item.file ? `${base}/${item.file}` : base;
}

const GH_LEVEL = { error: "error", review: "warning", warn: "warning", info: "notice" };

/** GitHub workflow commands; messages are single-line and escaped. */
export function annotate(items, packagePathOf) {
  if (!process.env.GITHUB_ACTIONS) return;
  const esc = (s) => String(s).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
  const prop = (s) => esc(s).replace(/:/g, "%3A").replace(/,/g, "%2C");
  for (const item of items) {
    if (item.level === "info") continue;
    const file = annotationFile(item, packagePathOf);
    const where = [file && `file=${prop(file)}`, item.line && `line=${item.line}`, `title=${prop(item.rule)}`].filter(Boolean).join(",");
    console.log(`::${GH_LEVEL[item.level]} ${where}::${esc(item.id ? `${item.id}: ${item.message}` : item.message)}`);
  }
}

export function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function printFindings(items) {
  const mark = { error: "✗", review: "?", warn: "!", info: "·" };
  for (const item of items) {
    const at = item.file ? ` ${item.file}${item.line ? `:${item.line}` : ""}` : "";
    console.log(`${mark[item.level]} [${item.rule}] ${item.id ?? ""}${at} ${item.message}${item.waived ? ` (waived: ${item.waived.reason})` : ""}`);
  }
}
