// What a package may contain (CONTRIBUTING.md, "Automated checks"): known
// file types whose bytes match their names, no programs, no WebAssembly of
// unknown origin, no credentials, fonts with their licenses; and metadata
// that has to agree with the contributions (tags, language packs).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EXTENSIONS_DIR, extensionIds, mathFontFolders } from "../lib.mjs";

const TEXT = new Set(["js", "mjs", "cjs", "json", "md", "txt", "css", "html", "htm", "svg", "toml", "aff", "dic", "xml", "csv", "yaml", "yml"]);
const MEDIA = new Set(["png", "jpg", "jpeg", "webp", "gif", "ico", "woff", "woff2", "ttf", "otf", "wasm", "pdf", "mp3", "ogg", "wav", "mp4", "webm"]);
const PROGRAM = new Set(["exe", "dll", "dylib", "so", "node", "bin", "app", "msi", "pkg", "dmg", "sh", "bat", "cmd", "ps1", "jar", "class", "pyc"]);
const FONT = /\.(woff2?|ttf|otf)$/i;

/** What the first bytes say a file is, when it is a program or an archive. */
function sniff(buf) {
  const hex = buf.subarray(0, 4).toString("hex");
  if (["feedface", "feedfacf", "cefaedfe", "cffaedfe", "cafebabe"].includes(hex)) return "a Mach-O program";
  if (hex === "7f454c46") return "an ELF program";
  if (buf.subarray(0, 2).toString("latin1") === "MZ") return "a Windows program";
  if (hex === "504b0304") return "a zip archive";
  if (hex === "0061736d") return "WebAssembly";
  if (hex === "1f8b0800" || buf.subarray(0, 2).toString("hex") === "1f8b") return "a gzip archive";
  return null;
}

/** Signatures of credentials that should never ship. */
const SECRETS = [
  [/AKIA[0-9A-Z]{16}/, "an AWS access key"],
  [/gh[pousr]_[A-Za-z0-9]{36,}/, "a GitHub token"],
  [/github_pat_[A-Za-z0-9_]{60,}/, "a GitHub token"],
  [/xox[abprs]-[A-Za-z0-9-]{10,}/, "a Slack token"],
  [/-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/, "a private key"],
  [/sk-ant-[A-Za-z0-9_-]{20,}/, "an Anthropic API key"],
  [/sk-(?:proj-)?[A-Za-z0-9_-]{40,}/, "an OpenAI API key"],
  [/glpat-[A-Za-z0-9_-]{20,}/, "a GitLab token"],
  [/AIza[0-9A-Za-z_-]{35}/, "a Google API key"],
];

export function checkFiles({ id, dir, manifest, files, vendored, findings }) {
  const fontFolders = mathFontFolders(manifest);
  const inFontFolder = (path) => fontFolders.some((folder) => path.startsWith(`${folder}/`));
  for (const path of files) {
    const name = path.split("/").pop();
    const ext = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
    const at = { file: path };
    if (PROGRAM.has(ext)) {
      findings.error("files/program", id, `.${ext} files are programs; the store does not accept prebuilt programs.`, at);
      continue;
    }
    const buf = readFileSync(join(dir, path));
    const kind = sniff(buf);
    if (kind && kind !== "WebAssembly" && !(kind === "a gzip archive" && ext === "gz"))
      findings.error("files/program", id, `This is ${kind}, whatever its name says.`, at);
    if (kind === "WebAssembly" && ext !== "wasm") findings.error("files/disguised", id, "This is WebAssembly under another name.", at);
    // Third-party code nobody can compare with its release is unreviewed code.
    if (/^(m?js|cjs|css)$/.test(ext) && path.split("/").includes("vendor") && !vendored.has(path))
      findings.review("vendor/unregistered", id, "Third-party file not registered in .typora/vendor.json, so it cannot be compared with its published package (node scripts/review/vendor.mjs add …).", at);
    if (ext === "wasm" && !vendored.has(path))
      findings.review("files/wasm", id, "WebAssembly that is not registered in .typora/vendor.json: show where it was built from.", at);
    if (ext && !TEXT.has(ext) && !MEDIA.has(ext))
      findings.review("files/type", id, `.${ext} is not a file type extensions usually ship; say what it is for.`, at);
    if (!ext && !/^(LICENSE|LICENCE|COPYING|NOTICE|AUTHORS)$/i.test(name))
      findings.review("files/type", id, "A file without an extension: say what it is for.", at);
    if (TEXT.has(ext) && !vendored.has(path) && buf.length < 2 * 1024 * 1024) {
      const text = buf.toString("utf8");
      for (const [re, what] of SECRETS) {
        const m = re.exec(text);
        if (m) findings.error("files/secret", id, `Looks like ${what}; anything in a package is public. Let the user enter it in settings (typora.secrets).`, { file: path, line: text.slice(0, m.index).split("\n").length });
      }
    }
  }

  // Bundled fonts carry their license (MathJax font folders are packages
  // copied with theirs).
  const fonts = files.filter((p) => FONT.test(p) && !inFontFolder(p));
  if (fonts.length) {
    const licenses = files.filter((p) => /licen[cs]e|\bofl\b|copying/i.test(p.split("/").pop()));
    if (!licenses.length) findings.error("files/font-license", id, `${fonts.length} bundled font file(s) without a license file (LICENSE, OFL.txt, …) next to them.`, { file: fonts[0] });
  }

  const c = manifest.contributes && typeof manifest.contributes === "object" ? manifest.contributes : {};
  const tags = Array.isArray(manifest.tags) ? manifest.tags : [];
  for (const [key, tag] of [["imageUploaders", "Image Uploader"], ["syncProviders", "Data Sync"], ["publishAdapters", "Publish"], ["fileViewers", "File Viewer"]])
    if (Array.isArray(c[key]) && c[key].length && !tags.includes(tag))
      findings.warn("meta/tag", id, `Contributes ${key} but is not tagged "${tag}", the store filter people look for it under.`);
}

/** Keys of one localization file, flattened. */
function keysOf(json, prefix = "", out = new Set()) {
  for (const [k, v] of Object.entries(json ?? {})) {
    if (v && typeof v === "object" && !Array.isArray(v)) keysOf(v, `${prefix}${k}.`, out);
    else out.add(`${prefix}${k}`);
  }
  return out;
}

/**
 * A language pack against the others in the store: keys the others have and
 * it lacks (untranslated), keys nobody else has (likely misspelt).
 */
export function checkLocalization({ id, dir, manifest, findings }) {
  const own = manifest.contributes?.localizations;
  if (!Array.isArray(own) || !own.length) return;
  const read = (base, path) => {
    try {
      return keysOf(JSON.parse(readFileSync(join(base, path), "utf8")));
    } catch {
      return null;
    }
  };
  const counts = new Map();
  let packs = 0;
  for (const other of extensionIds()) {
    if (other === id) continue;
    let m;
    try {
      m = JSON.parse(readFileSync(join(EXTENSIONS_DIR, other, "typora-extension.json"), "utf8"));
    } catch {
      continue;
    }
    for (const l of m.contributes?.localizations ?? []) {
      const keys = read(join(EXTENSIONS_DIR, other), l.path);
      if (!keys) continue;
      packs++;
      for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  if (packs < 3) return;
  const common = [...counts].filter(([, n]) => n >= packs / 2).map(([k]) => k);
  for (const l of own) {
    const keys = read(dir, l.path);
    if (!keys) continue;
    const missing = common.filter((k) => !keys.has(k));
    if (missing.length / common.length > 0.2)
      findings.warn("l10n/coverage", id, `${l.locale ?? l.path} translates ${common.length - missing.length} of the ${common.length} strings most packs have.`, { file: l.path });
    const unknown = [...keys].filter((k) => !counts.has(k));
    if (unknown.length)
      findings.warn("l10n/unknown-key", id, `${unknown.length} key(s) no other pack has, e.g. ${unknown.slice(0, 3).map((k) => JSON.stringify(k.length > 40 ? `${k.slice(0, 40)}…` : k)).join(", ")}: check the spelling.`, { file: l.path });
  }
}
