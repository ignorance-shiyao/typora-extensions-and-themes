// Shared helpers for validate / build / permission-diff. Zero dependencies.

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const EXTENSIONS_DIR = join(ROOT, "extensions");
export const MANIFEST = "typora-extension.json";
export const REPO_URL = "https://github.com/typora/extensions";
export const DOCS_URL = "https://docs.typora.io/extensions/";
export const SITE_ORIGIN = "https://extensions.typora.io";

/** Per-file and per-package limits (docs/extensions.md §8.6, "bundle size"). */
export const MAX_FILE_BYTES = 1024 * 1024;
export const MAX_PACKAGE_BYTES = 5 * 1024 * 1024;

// Same rules as packages/workbench/src/extensions/manifest.ts.
export const EXTENSION_ID_PATTERN = /^[a-z0-9][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)+$/;
export const VERSION_PATTERN = /^\d+\.\d+\.\d+([-+].*)?$/;
const NETWORK_ORIGIN = /^https?:\/\/(\*\.)?[a-z0-9.-]+(:\d{1,5})?$/i;

export const CONTRIBUTION_KEYS = [
  "themes",
  "templates",
  "snippets",
  "customFormats",
  "keyBindings",
  "texMacros",
  "grammars",
  "inlineRules",
  "fenceRenderers",
  "detailViews",
  "fileViewers",
  "commands",
  "menus",
  "inputRules",
  "configuration",
];

const MANIFEST_KEYS = new Set([
  "$schema",
  "id",
  "name",
  "version",
  "engines",
  "description",
  "author",
  "repository",
  "keywords",
  "l10n",
  "permissions",
  "contributes",
  "main",
  "background",
  "activationEvents",
]);

const isObject = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const nonEmpty = (v) => typeof v === "string" && v.trim().length > 0;

export function isRelativeAssetPath(value) {
  if (!nonEmpty(value)) return false;
  if (value.startsWith("/") || value.includes("\\") || /^[a-z]+:/i.test(value)) return false;
  return value.split("/").every((part) => part !== ".." && part !== "");
}

/** Extension folder names under extensions/, sorted. */
export function extensionIds() {
  if (!existsSync(EXTENSIONS_DIR)) return [];
  return readdirSync(EXTENSIONS_DIR, { withFileTypes: true })
    .filter((d) => !d.name.startsWith("."))
    .map((d) => d.name)
    .sort();
}

/** Files that go into the package: relative `/` paths, sorted, dotfiles skipped. */
export function packageFiles(dir) {
  const out = [];
  const walk = (rel) => {
    for (const entry of readdirSync(join(dir, rel), { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const path = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path);
      else out.push(path);
    }
  };
  walk("");
  return out.sort(compareBytes);
}

/** Every dotfile / dot-folder under `dir` (not packaged; reported by validate). */
export function hiddenFiles(dir) {
  const out = [];
  const walk = (rel) => {
    for (const entry of readdirSync(join(dir, rel), { withFileTypes: true })) {
      const path = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.name.startsWith(".")) out.push(path);
      else if (entry.isDirectory()) walk(path);
    }
  };
  walk("");
  return out;
}

export function compareBytes(a, b) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return Buffer.compare(x, y);
}

export function readManifest(id) {
  const text = readFileSync(join(EXTENSIONS_DIR, id, MANIFEST), "utf8");
  return JSON.parse(text);
}

/**
 * Check one manifest. Returns `{ errors, warnings }` (user-facing English).
 * `dir` is the extension folder; `folderId` its name.
 */
export function checkManifest(raw, dir, folderId) {
  const errors = [];
  const warnings = [];
  if (!isObject(raw)) return { errors: [`${MANIFEST} must be an object.`], warnings };

  if (typeof raw.id !== "string" || raw.id.length > 64 || !EXTENSION_ID_PATTERN.test(raw.id))
    errors.push('id must look like "author.name" (lowercase letters, digits, dots, hyphens; at most 64 characters).');
  else if (raw.id !== folderId) errors.push(`The folder is named ${folderId} but the id is ${raw.id}.`);
  if (!nonEmpty(raw.name)) errors.push("name is required.");
  if (!nonEmpty(raw.version) || !VERSION_PATTERN.test(raw.version))
    errors.push("version must be semver (1.2.3).");
  if (!nonEmpty(raw.description)) warnings.push("description is empty; the store shows it on the card.");
  if (!nonEmpty(raw.author)) warnings.push("author is empty.");
  for (const key of Object.keys(raw))
    if (!MANIFEST_KEYS.has(key)) warnings.push(`Unknown manifest key "${key}".`);
  if (raw.engines !== undefined && !(isObject(raw.engines) && (raw.engines.typora === undefined || nonEmpty(raw.engines.typora))))
    errors.push('engines must look like { "typora": ">=2.0.0" }.');
  if (raw.keywords !== undefined && !(Array.isArray(raw.keywords) && raw.keywords.every(nonEmpty)))
    errors.push("keywords must be an array of strings.");

  const exists = (rel) => existsSync(join(dir, rel));
  const isDir = (rel) => exists(rel) && statSync(join(dir, rel)).isDirectory();
  const isFile = (rel) => exists(rel) && statSync(join(dir, rel)).isFile();
  const needFile = (rel, where) => {
    if (!isRelativeAssetPath(rel)) errors.push(`${where}: "${rel}" must be a relative path inside the extension.`);
    else if (!isFile(rel)) errors.push(`${where}: ${rel} does not exist.`);
  };
  const needDir = (rel, where) => {
    const trimmed = typeof rel === "string" ? rel.replace(/\/+$/, "") : rel;
    if (!isRelativeAssetPath(trimmed)) errors.push(`${where}: "${rel}" must be a relative folder path.`);
    else if (!isDir(trimmed)) errors.push(`${where}: folder ${trimmed} does not exist.`);
  };

  for (const name of ["main", "background"]) {
    if (raw[name] === undefined) continue;
    if (!/\.m?js$/.test(String(raw[name]))) errors.push(`${name} must be a .js file.`);
    needFile(raw[name], name);
  }
  if (raw.l10n !== undefined) needDir(raw.l10n, "l10n");

  // permissions
  const perms = raw.permissions;
  if (perms !== undefined) {
    if (!isObject(perms)) errors.push("permissions must be an object.");
    else {
      for (const key of Object.keys(perms))
        if (!["network", "document", "workspace", "clipboard"].includes(key))
          errors.push(`Unknown permission "${key}".`);
      if (perms.network !== undefined) {
        if (!Array.isArray(perms.network) || !perms.network.length)
          errors.push("permissions.network must be a non-empty array of origins.");
        else
          for (const origin of perms.network)
            if (typeof origin !== "string" || !NETWORK_ORIGIN.test(origin.replace(/\/$/, "")))
              errors.push(`permissions.network: "${origin}" is not an https?://host[:port] origin.`);
            else if (origin.startsWith("http:")) warnings.push(`permissions.network: ${origin} is not https.`);
      }
      if (perms.document !== undefined && perms.document !== "read" && perms.document !== "write")
        errors.push('permissions.document must be "read" or "write".');
      if (perms.workspace !== undefined && perms.workspace !== "read")
        errors.push('permissions.workspace must be "read".');
      if (perms.clipboard !== undefined && perms.clipboard !== true)
        errors.push("permissions.clipboard must be true when present.");
    }
  }

  // contributes
  const c = raw.contributes;
  if (c !== undefined && !isObject(c)) errors.push("contributes must be an object.");
  if (isObject(c)) {
    for (const key of Object.keys(c))
      if (!CONTRIBUTION_KEYS.includes(key)) warnings.push(`Unknown contribution point "${key}".`);
    for (const key of ["templates", "snippets"]) if (c[key] !== undefined) needDir(c[key], `contributes.${key}`);
    const arr = (key) => (c[key] === undefined ? [] : Array.isArray(c[key]) ? c[key] : (errors.push(`contributes.${key} must be an array.`), []));
    const network = isObject(perms) && Array.isArray(perms.network) ? perms.network : [];
    arr("themes").forEach((t, i) => {
      const path = typeof t === "string" ? t : isObject(t) ? t.path : undefined;
      needFile(path, `contributes.themes[${i}]`);
    });
    arr("grammars").forEach((g, i) => {
      if (isObject(g) && g.path !== undefined) needFile(g.path, `contributes.grammars[${i}]`);
    });
    arr("fenceRenderers").forEach((r, i) => {
      const where = `contributes.fenceRenderers[${i}]`;
      if (!isObject(r)) return errors.push(`${where} must be an object.`);
      if (r.entry !== undefined) needFile(r.entry, `${where}.entry`);
      if (r.kroki !== undefined && !network.length) errors.push(`${where} uses Kroki but declares no network permission.`);
      if (r.resolver === true && raw.main === undefined) errors.push(`${where} has resolver: true but no main.`);
      if (r.kroki === undefined && r.entry === undefined && r.resolver !== true) errors.push(`${where} needs kroki, entry or resolver.`);
    });
    arr("detailViews").forEach((v, i) => {
      const where = `contributes.detailViews[${i}]`;
      if (!isObject(v)) return errors.push(`${where} must be an object.`);
      if (v.entry !== undefined) needFile(v.entry, `${where}.entry`);
      if (v.provider === "main" && raw.main === undefined) errors.push(`${where} uses provider: "main" but there is no main.`);
    });
    arr("fileViewers").forEach((v, i) => {
      const where = `contributes.fileViewers[${i}]`;
      if (!isObject(v)) return errors.push(`${where} must be an object.`);
      if (v.entry !== undefined) needFile(v.entry, `${where}.entry`);
      else if (raw.main === undefined) errors.push(`${where} needs an entry (or a main that resolves it).`);
    });
    arr("inlineRules").forEach((r, i) => {
      if (!isObject(r) || !nonEmpty(r.pattern)) return errors.push(`contributes.inlineRules[${i}] needs a pattern.`);
      try {
        const flags = typeof r.flags === "string" ? r.flags.replace(/[^imsu]/g, "") : "";
        new RegExp(r.pattern, flags.includes("u") ? flags : `${flags}u`);
      } catch {
        errors.push(`contributes.inlineRules[${i}]: invalid pattern.`);
      }
    });
    if (c.configuration !== undefined && !(isObject(c.configuration) && isObject(c.configuration.properties)))
      errors.push("contributes.configuration needs properties.");
  }
  return { errors, warnings };
}

/** Normalized permission set (same shape as manifest.ts produces). */
export function normalizePermissions(raw) {
  const p = isObject(raw) ? raw : {};
  const out = {};
  if (Array.isArray(p.network) && p.network.length)
    out.network = [...new Set(p.network.map((o) => String(o).replace(/\/$/, "")))].sort();
  if (p.document === "read" || p.document === "write") out.document = p.document;
  if (p.workspace === "read") out.workspace = "read";
  if (p.clipboard === true) out.clipboard = true;
  return out;
}

/** True when an L1 page ships with the extension. */
export function hasPages(manifest, files) {
  const c = isObject(manifest.contributes) ? manifest.contributes : {};
  const entries = ["fenceRenderers", "detailViews", "fileViewers"].some(
    (key) => Array.isArray(c[key]) && c[key].some((item) => isObject(item) && item.entry !== undefined),
  );
  return entries || files.some((f) => /\.html?$/i.test(f));
}

export function tierOf(manifest, files) {
  if (manifest.main !== undefined || manifest.background !== undefined) return "L2";
  if (hasPages(manifest, files)) return "L1";
  return "L0";
}

/** Last commit time touching `path` as `YYYY-MM-DDTHH:MM:SSZ`, or null. */
export function gitTime(path) {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%cI", "--", path], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return out ? isoSeconds(new Date(out)) : null;
  } catch {
    return null;
  }
}

export const isoSeconds = (date) => date.toISOString().replace(/\.\d{3}Z$/, "Z");

export function git(args, options = {}) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options });
}

// ── Zip ────────────────────────────────────────────────────────────────
// Deterministic: callers pass entries already sorted; every entry gets the
// same timestamp (1980-01-01 00:00, the DOS epoch) and mode 0644.

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

export function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const DOS_TIME = 0;
const DOS_DATE = (0 << 9) | (1 << 5) | 1; // 1980-01-01

/** `entries`: `[{ name, data: Buffer }]` → zip Buffer. */
export function zip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, "utf8");
    const deflated = deflateRawSync(data, { level: 9 });
    const stored = deflated.length >= data.length;
    const body = stored ? data : deflated;
    const crc = crc32(data);
    const method = stored ? 0 : 8;
    const flags = 0x0800; // UTF-8 names

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE((3 << 8) | 20, 4); // made by: Unix, 2.0
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30); // extra
    central.writeUInt16LE(0, 32); // comment
    central.writeUInt16LE(0, 34); // disk
    central.writeUInt16LE(0, 36); // internal attrs
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);

    offset += local.length + nameBuf.length + body.length;
  }
  const centralSize = centrals.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}
