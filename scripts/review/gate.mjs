// The gate (CONTRIBUTING.md, "Automated checks"): what a pull request touches
// and who sends it, decided from GitHub's metadata alone — no code from the
// pull request runs. Pure; scripts/pr-gate.mjs feeds it.

import { normalizePermissions } from "../lib.mjs";
import { Findings } from "./findings.mjs";

const PACKAGE_PATH = /^(extensions|themes)\/([^/]+)\//;
/** Associations that make someone a maintainer of this repository. */
const MAINTAINER = new Set(["OWNER", "MEMBER"]);
const FIRST_TIME = new Set(["FIRST_TIME_CONTRIBUTOR", "FIRST_TIMER", "NONE"]);
/** Labels the gate sets; it removes them again when they stop applying. */
export const MANAGED_LABEL = (label) => /^(perm:|tier:)/.test(label) || ["new-package", "package-update", "tooling", "theme", "first-time-author"].includes(label);

export const prefixOf = (id) => id.split(".")[0];

/** What a name looks like, ignoring case, separators and look-alike characters. */
export function skeleton(text) {
  return String(text)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[аеорсух]/g, (c) => ({ "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "у": "y", "х": "x" })[c])
    .replace(/rn/g, "m")
    .replace(/vv/g, "w")
    .replace(/[0]/g, "o")
    .replace(/[1!|i]/g, "l")
    .replace(/3/g, "e")
    .replace(/5/g, "s")
    .replace(/[^a-z0-9]/g, "");
}

export function distance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const next = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = row[j];
      row[j] = next;
    }
  }
  return row[b.length];
}

/** Login or "@maintainers" lists per namespace; see review/owners.json. */
function ownsNamespace(owners, prefix, login, maintainer) {
  const list = owners.namespaces?.[prefix];
  if (!list) return null;
  return list.some((who) => (who === "@maintainers" ? maintainer : who.toLowerCase() === login.toLowerCase()));
}

/**
 * pr: { author, association, labels, body }
 * files: [{ filename, previous_filename? }]
 * manifests: Map<id, manifest | null>   the head's manifest of each changed package
 * base: { ids: [], names: Map<id, name> }
 */
export function gate({ pr, files, manifests, base, owners }) {
  const findings = new Findings();
  const maintainer = MAINTAINER.has(pr.association) || (owners.maintainers ?? []).some((m) => m.toLowerCase() === pr.author.toLowerCase());
  const paths = files.flatMap((f) => [f.filename, f.previous_filename].filter(Boolean));
  const ids = new Set();
  const tooling = [];
  for (const path of paths) {
    const m = PACKAGE_PATH.exec(path);
    if (m && !(m[1] === "themes" && m[2] === "built-in")) ids.add(m[2]);
    else tooling.push(path);
  }

  if (tooling.length && !maintainer && !pr.labels.includes("allow-tooling"))
    findings.error("gate/tooling", null, `Changes outside a package folder (${tooling.slice(0, 5).join(", ")}${tooling.length > 5 ? ", …" : ""}). A package pull request changes only extensions/<id>/ or themes/<id>/; a maintainer can label it allow-tooling.`);
  else if (tooling.length) findings.review("gate/tooling", null, `Changes the store's tooling (${tooling.length} file(s)); the checks below ran with the base branch's version of it.`);

  if (ids.size > 1 && !maintainer)
    findings.error("gate/one-package", null, `Changes ${ids.size} packages (${[...ids].join(", ")}); send one pull request per package.`);

  const baseIds = new Set(base.ids);
  const newIds = [...ids].filter((id) => !baseIds.has(id) && manifests.get(id));
  const prefixes = new Set(base.ids.map(prefixOf));
  for (const id of ids) {
    const prefix = prefixOf(id);
    const owns = ownsNamespace(owners, prefix, pr.author, maintainer);
    const reserved = owners.reserved?.includes(prefix);
    // Nobody adds a package to someone else's namespace; anyone may propose a
    // fix to an existing one, which its owner or a maintainer then approves.
    if (newIds.includes(id) && !maintainer && (reserved || owns === false))
      findings.error("gate/namespace", id, reserved ? `${prefix}.* is reserved for Typora.` : `${prefix}.* belongs to ${owners.namespaces[prefix].join(", ")}.`);
    else if (!maintainer && (reserved || owns === false))
      findings.review("gate/not-owner", id, `A change to ${id} from outside its namespace (${reserved ? "Typora" : owners.namespaces[prefix].join(", ")}): its owner or a maintainer approves it.`);
    else if (owns === null)
      findings.review("gate/new-namespace", id, `${prefix}.* is not registered yet. After review, a maintainer adds "${prefix}": ["${pr.author}"] to review/owners.json.`);
  }

  // Look-alikes of existing packages and namespaces.
  for (const id of newIds) {
    const prefix = prefixOf(id);
    if (!prefixes.has(prefix)) {
      for (const other of prefixes) {
        const a = skeleton(prefix);
        const b = skeleton(other);
        if (a === b || (a.length >= 4 && distance(a, b) <= 1) || (other === "typora" && a.includes("typora")))
          findings.review("gate/confusable", id, `The namespace ${prefix} looks like ${other}.`);
      }
    }
    // Within a namespace it is the same owner: lang-pt and lang-pl are fine.
    const name = manifests.get(id)?.name;
    for (const [other, otherName] of base.names)
      if (prefixOf(other) !== prefix && name && otherName && skeleton(name) === skeleton(otherName))
        findings.review("gate/confusable", id, `"${name}" reads like ${other}'s name "${otherName}".`);
    for (const other of base.ids) {
      if (prefixOf(other) === prefix) continue;
      const a = skeleton(id);
      const b = skeleton(other);
      if (a === b || (a.length >= 8 && distance(a, b) <= 1)) findings.review("gate/confusable", id, `${id} reads like ${other}.`);
    }
  }

  // Every permission is explained in the description (CONTRIBUTING.md, "Rules").
  const body = String(pr.body ?? "");
  const permissionKeys = new Set();
  for (const [id, manifest] of manifests) {
    if (!manifest) continue;
    for (const key of Object.keys(normalizePermissions(manifest.permissions))) {
      permissionKeys.add(key);
      if (!new RegExp(`\\b${key}\\b`, "i").test(body))
        findings.review("gate/undocumented-permission", id, `The description does not explain the ${key} permission.`);
    }
  }

  const labels = [];
  if (newIds.length) labels.push("new-package");
  if ([...ids].some((id) => baseIds.has(id))) labels.push("package-update");
  if (tooling.length) labels.push("tooling");
  if ([...ids].some((id) => paths.some((p) => p.startsWith(`themes/${id}/`)))) labels.push("theme");
  if (FIRST_TIME.has(pr.association)) labels.push("first-time-author");
  for (const key of [...permissionKeys].sort()) labels.push(`perm:${key}`);

  return {
    findings: findings.items,
    labels,
    facts: {
      maintainer,
      firstTime: FIRST_TIME.has(pr.association),
      tooling: tooling.length > 0,
      ids: [...ids].sort(),
      newIds,
      notOwner: findings.items.some((f) => f.rule === "gate/namespace" || f.rule === "gate/not-owner"),
      newNamespace: findings.items.some((f) => f.rule === "gate/new-namespace"),
    },
  };
}
