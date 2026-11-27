#!/usr/bin/env node
// The gate for one pull request (scripts/review/gate.mjs), run by
// .github/workflows/pr-gate.yml on pull_request_target from the base branch.
// It reads the pull request through the API only and never checks it out.
//
//   GITHUB_TOKEN=… GITHUB_REPOSITORY=typora/… PR_NUMBER=12 node scripts/pr-gate.mjs [--out results]
//
// Sets the labels it manages, keeps one comment up to date, writes the job
// summary and exits 1 when the gate refuses the pull request.

import { appendFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MANIFEST, packageIds, readManifest } from "./lib.mjs";
import { annotate, writeJson } from "./review/findings.mjs";
import { MANAGED_LABEL, gate } from "./review/gate.mjs";
import { fileAt, gh, ghAll, md, repo, syncLabels, upsertComment } from "./review/github.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MARKER = "<!-- typora-pr-gate -->";

/** The pull request's facts the gate decides on; used by the review policy too. */
export async function gateFor(number) {
  const pr = await gh(`/repos/${repo()}/pulls/${number}`);
  const files = await ghAll(`/repos/${repo()}/pulls/${number}/files`);
  const owners = JSON.parse(readFileSync(join(ROOT, "review", "owners.json"), "utf8"));
  const changed = new Set();
  for (const f of files)
    for (const path of [f.filename, f.previous_filename].filter(Boolean)) {
      const m = /^(extensions|themes)\/([^/]+)\//.exec(path);
      if (m && m[2] !== "built-in") changed.add(`${m[1]}/${m[2]}`);
    }
  const manifests = new Map();
  for (const folder of changed) {
    const text = await fileAt(`${folder}/${MANIFEST}`, pr.head.sha);
    let manifest = null;
    try {
      manifest = text === null ? null : JSON.parse(text);
    } catch {
      manifest = null; // validate.mjs reports it.
    }
    manifests.set(folder.split("/")[1], manifest);
  }
  const ids = packageIds();
  const names = new Map(ids.map((id) => {
    try {
      return [id, readManifest(id).name];
    } catch {
      return [id, null];
    }
  }));
  const result = gate({
    pr: { author: pr.user.login, association: pr.author_association, labels: pr.labels.map((l) => l.name), body: pr.body },
    files,
    manifests,
    base: { ids, names },
    owners,
  });
  return { pr, result };
}

function render(result) {
  const { findings, facts } = result;
  let out = "### Gate\n\n";
  out += `Packages: ${facts.ids.length ? facts.ids.map((id) => `\`${id}\``).join(", ") : "none"}`;
  out += facts.newIds.length ? ` (new: ${facts.newIds.map((id) => `\`${id}\``).join(", ")})` : "";
  out += `${facts.maintainer ? " · sent by a maintainer" : ""}${facts.firstTime ? " · first contribution" : ""}\n\n`;
  if (!findings.length) return `${out}Nothing to flag.\n`;
  const icon = { error: "❌", review: "👀", warn: "⚠️", info: "ℹ️" };
  for (const f of findings) out += `- ${icon[f.level]} ${f.id ? `\`${f.id}\` ` : ""}${md(f.message)}\n`;
  return out;
}

async function main() {
  const number = Number(process.env.PR_NUMBER);
  if (!Number.isInteger(number) || number <= 0) throw new Error("PR_NUMBER must be a pull request number.");
  const outAt = process.argv.indexOf("--out");
  const { pr, result } = await gateFor(number);
  const text = render(result);
  if (outAt > 0) writeJson(join(process.argv[outAt + 1], "gate.json"), result);
  annotate(result.findings, (id) => id);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
  console.log(text);
  await syncLabels(number, pr.labels.map((l) => l.name), result.labels, MANAGED_LABEL);
  await upsertComment(number, MARKER, text);
  process.exit(result.findings.some((f) => f.level === "error") ? 1 : 0);
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  main().catch((error) => {
    console.error(error.stack ?? error.message);
    process.exit(2);
  });
