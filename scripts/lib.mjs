// Shared helpers for validate / build / permission-diff. Zero dependencies.

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const EXTENSIONS_DIR = join(ROOT, "extensions");
export const MANIFEST = "typora-extension.json";
export const REPO_URL = "https://github.com/typora/typora-extensions";
export const DOCS_URL = "https://docs.typora.io/extensions/";
export const SITE_ORIGIN = "https://extensions.typora.io";

/** Per-file and per-package limits (docs/extensions.md §8.6, "bundle size"). */
export const MAX_FILE_BYTES = 1024 * 1024;
export const MAX_PACKAGE_BYTES = 5 * 1024 * 1024;
/**
 * Language packs: a Hunspell dictionary file may be larger (the app reads up
 * to 32 MB per file), and so may a pack (the app downloads up to 50 MB).
 */
export const MAX_DICTIONARY_FILE_BYTES = 32 * 1024 * 1024;
export const MAX_LANGUAGE_PACK_BYTES = 128 * 1024 * 1024;
const LANGUAGE_TAG = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
const SF_SYMBOL = /^[a-z0-9]+(\.[a-z0-9]+)*$/;

/** Files named by `contributes.dictionaries` (exempt from MAX_FILE_BYTES). */
export function dictionaryFiles(raw) {
  const list = isObject(raw?.contributes) && Array.isArray(raw.contributes.dictionaries) ? raw.contributes.dictionaries : [];
  return new Set(list.flatMap((d) => (isObject(d) ? [d.aff, d.dic].filter((p) => typeof p === "string") : [])));
}

// Same rules as packages/workbench/src/extensions/manifest.ts.
export const EXTENSION_ID_PATTERN = /^[a-z0-9][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)+$/;
export const VERSION_PATTERN = /^\d+\.\d+\.\d+([-+].*)?$/;
const NETWORK_ORIGIN = /^https?:\/\/(\*\.)?[a-z0-9.-]+(:\d{1,5})?$/i;
/** `{config.<key>}`: the server the user enters in that setting. */
export const CONFIG_ORIGIN = /^\{config\.([A-Za-z][A-Za-z0-9_.-]{0,63})\}$/;
/** A command named in permissions.process (no paths). */
const COMMAND_NAME = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/;
/** `<os>-<arch>` keys of a binaries entry. */
export const BINARY_TARGETS = ["darwin-arm64", "darwin-x64", "darwin-universal", "linux-arm64", "linux-x64", "win32-arm64", "win32-x64"];

export const CONTRIBUTION_KEYS = [
  "localizations",
  "dictionaries",
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
  "tags",
  "l10n",
  "permissions",
  "binaries",
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

/** Store tags, in the order the website lists them. */
export const TAGS = ["Language Pack", "Markdown Extension", "Diagram", "Math", "Theme", "Writing", "Template", "AI", "Media", "Export / Share", "Productivity", "File Viewer", "View", "Developer"];

/**
 * Store images in the extension folder, shown on the website only and not
 * packaged: `cover.webp` (2:1) on the card, `screenshot.webp` (16:10) on the
 * extension's page. PNG and JPEG work too.
 */
export const STORE_IMAGE_PATTERN = /^(cover|screenshot)\.(png|jpe?g|webp)$/i;
/** Width / height each store image should have. */
export const STORE_IMAGE_RATIOS = { cover: 2, screenshot: 1.6 };

export function storeImage(dir, kind) {
  return readdirSync(dir).find((name) => STORE_IMAGE_PATTERN.test(name) && name.split(".")[0].toLowerCase() === kind) ?? null;
}

/** Store images above this get a warning: compress them (lossless WebP for screenshots). */
export const STORE_IMAGE_WARN_BYTES = 300 * 1024;

/** `{ width, height }` of a PNG or WebP, or null for other formats. */
export function imageSize(buf) {
  if (buf.length >= 24 && buf.toString("ascii", 1, 4) === "PNG")
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  if (buf.length < 30 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") return null;
  const chunk = buf.toString("ascii", 12, 16);
  if (chunk === "VP8 ") return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  if (chunk === "VP8L") {
    const bits = buf.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X") return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 };
  return null;
}

/**
 * Files that go into the package: relative `/` paths, sorted, dotfiles and
 * store images skipped.
 */
export function packageFiles(dir) {
  const out = [];
  const walk = (rel) => {
    for (const entry of readdirSync(join(dir, rel), { withFileTypes: true })) {
      if (entry.name.startsWith(".") || (!rel && STORE_IMAGE_PATTERN.test(entry.name))) continue;
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
  if (raw.tags !== undefined) {
    if (!Array.isArray(raw.tags)) errors.push(`tags must be an array of: ${TAGS.join(", ")}.`);
    else for (const tag of raw.tags) if (!TAGS.includes(tag)) errors.push(`Unknown tag "${tag}" (use ${TAGS.join(", ")}).`);
  } else warnings.push("tags is empty; the store filters by them.");

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
        if (!["network", "document", "workspace", "clipboard", "process", "ai"].includes(key))
          errors.push(`Unknown permission "${key}".`);
      if (perms.network !== undefined) {
        if (!Array.isArray(perms.network) || !perms.network.length)
          errors.push("permissions.network must be a non-empty array of origins.");
        else
          for (const origin of perms.network) {
            const key = typeof origin === "string" ? CONFIG_ORIGIN.exec(origin)?.[1] : undefined;
            if (key !== undefined) {
              const properties = isObject(raw.contributes?.configuration?.properties) ? raw.contributes.configuration.properties : {};
              const property = properties[key];
              const literal = perms.network.filter((o) => typeof o === "string" && NETWORK_ORIGIN.test(o.replace(/\/$/, "")));
              if (!isObject(property) || property.type !== "string")
                errors.push(`permissions.network: ${origin} needs a string setting named ${key}.`);
              // Only the user may point it somewhere: a default must be listed itself.
              else if (property.default && !literal.some((o) => o.replace(/\/$/, "") === settingOrigin(property.default)))
                errors.push(`permissions.network: the default of ${key} must be empty or one of the listed origins.`);
            } else if (typeof origin !== "string" || !NETWORK_ORIGIN.test(origin.replace(/\/$/, "")))
              errors.push(`permissions.network: "${origin}" is not an https?://host[:port] origin or {config.<setting>}.`);
            else if (origin.startsWith("http:")) warnings.push(`permissions.network: ${origin} is not https.`);
          }
      }
      if (perms.document !== undefined && perms.document !== "read" && perms.document !== "write")
        errors.push('permissions.document must be "read" or "write".');
      if (perms.workspace !== undefined && perms.workspace !== "read")
        errors.push('permissions.workspace must be "read".');
      if (perms.clipboard !== undefined && perms.clipboard !== true)
        errors.push("permissions.clipboard must be true when present.");
      if (perms.ai !== undefined && perms.ai !== true) errors.push("permissions.ai must be true when present.");
      if (
        perms.process !== undefined &&
        perms.process !== "*" &&
        !(Array.isArray(perms.process) && perms.process.every((name) => typeof name === "string" && COMMAND_NAME.test(name)))
      )
        errors.push('permissions.process must be "*" or a list of command names.');
    }
  }

  // binaries: programs in the package, one file per <os>-<arch>
  if (raw.binaries !== undefined) {
    if (!isObject(raw.binaries)) errors.push("binaries must be an object.");
    else {
      if (!isObject(perms) || perms.process === undefined) errors.push("binaries need permissions.process.");
      for (const [name, targets] of Object.entries(raw.binaries)) {
        if (!isObject(targets)) {
          errors.push(`binaries.${name} must map <os>-<arch> to a file.`);
          continue;
        }
        for (const [target, path] of Object.entries(targets)) {
          if (!BINARY_TARGETS.includes(target)) errors.push(`binaries.${name}: unknown target ${target}.`);
          else needFile(path, `binaries.${name}.${target}`);
        }
      }
      // The store builds every program from reviewed source; that build is not there yet.
      errors.push("Extensions with binaries cannot be published in the store yet: Typora's CI has to build them from source (§8.6).");
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
    // Typora ignores a malformed name and falls back to its default icon.
    const needSymbol = (value, where) => {
      if (value !== undefined && (typeof value !== "string" || !SF_SYMBOL.test(value)))
        errors.push(`${where} must be an SF Symbol name such as checklist or chart.bar.xaxis.`);
    };
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
      needSymbol(v.sfSymbol, `${where}.sfSymbol`);
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
      if (isObject(r.index)) needSymbol(r.index.sfSymbol, `contributes.inlineRules[${i}].index.sfSymbol`);
    });
    const locales = new Set();
    arr("localizations").forEach((l, i) => {
      const where = `contributes.localizations[${i}]`;
      if (!isObject(l)) return errors.push(`${where} must be an object.`);
      if (typeof l.locale !== "string" || !LANGUAGE_TAG.test(l.locale)) errors.push(`${where}.locale must be a language tag such as de or pt-BR.`);
      else if (locales.has(l.locale)) errors.push(`${where}: locale ${l.locale} appears twice.`);
      else locales.add(l.locale);
      if (!nonEmpty(l.name)) errors.push(`${where} needs the language's name in that language.`);
      if (!nonEmpty(l.englishName)) warnings.push(`${where} has no englishName.`);
      if (typeof l.path !== "string" || !l.path.endsWith(".json")) return errors.push(`${where}.path must be a .json file.`);
      needFile(l.path, `${where}.path`);
      if (!isRelativeAssetPath(l.path) || !isFile(l.path)) return;
      try {
        const catalog = JSON.parse(readFileSync(join(dir, l.path), "utf8"));
        if (!isObject(catalog) || Object.values(catalog).some((v) => typeof v !== "string"))
          errors.push(`${where}: ${l.path} must map English strings to translated strings.`);
      } catch (error) {
        errors.push(`${where}: ${l.path} is not valid JSON: ${error.message}`);
      }
    });
    arr("dictionaries").forEach((d, i) => {
      const where = `contributes.dictionaries[${i}]`;
      if (!isObject(d)) return errors.push(`${where} must be an object.`);
      if (typeof d.language !== "string" || !LANGUAGE_TAG.test(d.language)) errors.push(`${where}.language must be a language tag such as de or de-CH.`);
      needFile(d.aff, `${where}.aff`);
      needFile(d.dic, `${where}.dic`);
    });
    if ((c.localizations !== undefined || c.dictionaries !== undefined) && (raw.main !== undefined || raw.background !== undefined))
      errors.push("A language pack is data only: no main or background.");
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
  if (p.ai === true) out.ai = true;
  if (p.process === "*") out.process = "*";
  else if (Array.isArray(p.process)) out.process = [...new Set(p.process.map(String))].sort();
  return out;
}

/** The origin of a server address typed into a setting (https assumed), or null. */
export function settingOrigin(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const text = value.trim();
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
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
