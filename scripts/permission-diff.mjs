#!/usr/bin/env node
// Compare each changed extension with a base ref (docs/extensions.md §8.6):
// permissions added / removed, tier change, network origins, and the review
// depth the change needs. Also fails when a changed extension keeps its
// version: published downloads are immutable, so every change needs a bump.
//
//   node scripts/permission-diff.mjs origin/main
//
// Writes Markdown to $GITHUB_STEP_SUMMARY when set, and always to stdout.

import { appendFileSync } from "node:fs";
import {
  MANIFEST,
  git,
  isStoreOnlyImage,
  normalizePermissions,
  platformLabel,
  packageDir,
  packageFiles,
  packageIds,
  packagePath,
  readManifest,
  tierOf,
} from "./lib.mjs";

const base = process.argv[2];
if (!base) {
  console.error("Usage: node scripts/permission-diff.mjs <base-ref>");
  process.exit(2);
}
try {
  git(["rev-parse", "--verify", `${base}^{commit}`]);
} catch {
  console.error(`Unknown base ref: ${base}`);
  process.exit(2);
}

const show = (path) => {
  try {
    return git(["show", `${base}:${path}`]);
  } catch {
    return null;
  }
};
// `id` → its folder in the base ref, across extensions/ and themes/.
const basePaths = new Map(
  git(["ls-tree", "--name-only", base, "extensions/", "themes/"])
    .split("\n")
    .filter(Boolean)
    .filter((path) => path !== "themes/built-in")
    .map((path) => [path.replace(/^[^/]+\//, ""), path]),
);
const baseIds = [...basePaths.keys()];
const baseFiles = (id) =>
  git(["ls-tree", "-r", "--name-only", base, `${basePaths.get(id)}/`])
    .split("\n")
    .filter(Boolean)
    .map((p) => p.slice(`${basePaths.get(id)}/`.length));
/** Whether a packaged file changed; store images alone need no bump. */
const changed = (id) => {
  const prefix = `${packagePath(id)}/`;
  const paths = [
    ...git(["diff", "--name-only", base, "--", prefix]).split("\n"),
    // Untracked files are not seen by git diff; count them too.
    ...git(["ls-files", "--others", "--exclude-standard", "--", prefix]).split("\n"),
  ];
  return paths.some((p) => p && !isStoreOnlyImage(packageDir(id), p.slice(prefix.length)));
};

const DOC_LEVEL = { "": 0, read: 1, write: 2 };
const SENSITIVE = (p) => !!(p.network?.length || p.document || p.workspace || p.clipboard || p.process || p.ai);
const processText = (p) => (p === "*" ? "process: any program" : `process: ${p.length ? p.map((c) => `\`${c}\``).join(", ") : "its own binaries"}`);
const describe = (p) => {
  const out = [];
  if (p.network?.length) out.push(`network: ${p.network.map((o) => `\`${o}\``).join(", ")}`);
  if (p.document) out.push(`document: ${p.document}`);
  if (p.workspace) out.push(`workspace: ${p.workspace}`);
  if (p.clipboard) out.push("clipboard");
  if (p.ai) out.push("ai");
  if (p.process) out.push(processText(p.process));
  return out.length ? out.join("; ") : "none";
};
const semver = (v) => (String(v).match(/^(\d+)\.(\d+)\.(\d+)/) ?? []).slice(1).map(Number);
const compareVersions = (a, b) => {
  const [x, y] = [semver(a), semver(b)];
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
};

const rows = [];
const problems = [];
const ids = [...new Set([...packageIds(), ...baseIds])].sort();

for (const id of ids) {
  const headExists = packageIds().includes(id);
  const baseText = basePaths.has(id) ? show(`${basePaths.get(id)}/${MANIFEST}`) : null;
  if (!headExists) {
    rows.push({ id, status: "removed", version: "", platforms: "", perms: "", change: "", tier: "", review: "Confirm the removal" });
    continue;
  }
  if (baseText !== null && !changed(id)) continue;

  let head;
  try {
    head = readManifest(id);
  } catch {
    problems.push(`${id}: ${MANIFEST} cannot be read (run npm run validate).`);
    continue;
  }
  const headPerms = normalizePermissions(head.permissions);
  const headTier = tierOf(head, packageFiles(packageDir(id)));

  let old = null;
  try {
    old = baseText === null ? null : JSON.parse(baseText);
  } catch {
    old = null;
  }
  const oldPerms = normalizePermissions(old?.permissions);
  const oldTier = old ? tierOf(old, baseFiles(id)) : null;

  const added = [];
  const removed = [];
  const oldNet = new Set(oldPerms.network ?? []);
  const newNet = new Set(headPerms.network ?? []);
  for (const o of newNet) if (!oldNet.has(o)) added.push(`network \`${o}\``);
  for (const o of oldNet) if (!newNet.has(o)) removed.push(`network \`${o}\``);
  const d0 = DOC_LEVEL[oldPerms.document ?? ""];
  const d1 = DOC_LEVEL[headPerms.document ?? ""];
  if (d1 > d0) added.push(`document: ${headPerms.document}`);
  if (d1 < d0) removed.push(`document: ${oldPerms.document}`);
  if (headPerms.workspace && !oldPerms.workspace) added.push("workspace: read");
  if (!headPerms.workspace && oldPerms.workspace) removed.push("workspace: read");
  if (headPerms.clipboard && !oldPerms.clipboard) added.push("clipboard");
  if (!headPerms.clipboard && oldPerms.clipboard) removed.push("clipboard");
  if (headPerms.ai && !oldPerms.ai) added.push("ai");
  if (!headPerms.ai && oldPerms.ai) removed.push("ai");
  // Any change to what it may run widens or narrows it: name it either way.
  if (JSON.stringify(headPerms.process ?? null) !== JSON.stringify(oldPerms.process ?? null)) {
    if (headPerms.process) added.push(processText(headPerms.process));
    if (oldPerms.process) removed.push(processText(oldPerms.process));
  }

  const widened = !!old && added.length > 0;
  let review;
  if (widened) review = "**Human review**; users consent again on update";
  else if (SENSITIVE(headPerms)) review = "**Human review** of the code paths that use the permissions";
  else if (headTier === "L0") review = "Automated checks + light review";
  else review = "Light review of the shipped code (no permissions)";

  if (old) {
    const cmp = compareVersions(head.version, old.version);
    if (cmp === 0) problems.push(`${id}: files changed but the version is still ${head.version}. Bump it.`);
    else if (cmp < 0) problems.push(`${id}: version went down (${old.version} → ${head.version}).`);
  }

  // Platforms (`os`) are informational: they don't widen what it may do.
  const platforms = (os) => platformLabel(os) ?? "all";
  rows.push({
    id,
    status: old ? "updated" : "new",
    version: old ? `${old.version} → ${head.version}` : head.version,
    platforms: old && platforms(old.os) !== platforms(head.os) ? `${platforms(old.os)} → ${platforms(head.os)}` : platforms(head.os),
    perms: describe(headPerms),
    change: old
      ? [added.length && `➕ ${added.join(", ")}`, removed.length && `➖ ${removed.join(", ")}`].filter(Boolean).join("<br>") ||
        "unchanged"
      : "—",
    tier: oldTier && oldTier !== headTier ? `${oldTier} → ${headTier}` : headTier,
    review,
  });
}

let md = `## Extension changes vs \`${base}\`\n\n`;
if (!rows.length) md += "No extension changed.\n";
else {
  md += "| Extension | Status | Version | Platforms | Tier | Permissions | Permission change | Review |\n";
  md += "| --- | --- | --- | --- | --- | --- | --- | --- |\n";
  for (const r of rows)
    md += `| \`${r.id}\` | ${r.status} | ${r.version} | ${r.platforms} | ${r.tier} | ${r.perms} | ${r.change} | ${r.review} |\n`;
}
if (problems.length) md += `\n### Problems\n\n${problems.map((p) => `- ${p}`).join("\n")}\n`;

console.log(md);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${md}\n`);
if (process.env.GITHUB_ACTIONS) for (const p of problems) console.log(`::error::${p}`);
process.exit(problems.length ? 1 : 0);
