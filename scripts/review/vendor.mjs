#!/usr/bin/env node
// Online half of the vendored-library check (CONTRIBUTING.md, "Vendored
// libraries"): every file registered in a package's .typora/vendor.json is
// compared with the published package it claims to come from.
//
//   node scripts/review/vendor.mjs verify [id…]               registry vs lock vs files
//   node scripts/review/vendor.mjs add <id> <path> <from>      register a file or folder/
//   node scripts/review/vendor.mjs osv [id…]                   known vulnerabilities
//
// <from> is npm:<name>@<version>/<path in the tarball> (a folder ends in /)
// or an https URL of a single file.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { VENDOR_LOCK, packageDir, packageIds, packagePath, readVendorLock, sha256Hex, vendorLockFiles } from "../lib.mjs";
import { Findings, annotate, printFindings } from "./findings.mjs";

const NPM_SOURCE = /^npm:((?:@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*)@([^/\s]+)\/(.*)$/i;
const CACHE = join(process.env.RUNNER_TEMP ?? tmpdir(), "typora-vendor-cache");

export function parseSource(from) {
  const npm = NPM_SOURCE.exec(from);
  if (npm) return { kind: "npm", name: npm[1], version: npm[2], path: npm[3] };
  if (/^https:\/\/[^\s]+$/.test(from)) return { kind: "url", url: from };
  return null;
}

/** Files of a ustar / pax / GNU tar archive: Map<path, Buffer>. */
export function untar(buf) {
  const files = new Map();
  let offset = 0;
  let longName = null;
  const str = (start, length) => buf.toString("utf8", start, start + length).replace(/\0.*$/s, "");
  while (offset + 512 <= buf.length) {
    const header = buf.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) break;
    const size = parseInt(str(offset + 124, 12).trim() || "0", 8);
    const type = String.fromCharCode(header[156] || 48);
    const prefix = str(offset + 345, 155);
    let name = longName ?? (prefix ? `${prefix}/${str(offset, 100)}` : str(offset, 100));
    longName = null;
    const body = buf.subarray(offset + 512, offset + 512 + size);
    offset += 512 + Math.ceil(size / 512) * 512;
    if (type === "x") {
      // pax: "<len> path=<name>\n" records apply to the next entry.
      const path = /(?:^|\n)\d+ path=([^\n]*)\n/.exec(body.toString("utf8"));
      if (path) longName = path[1];
      continue;
    }
    if (type === "L") {
      longName = body.toString("utf8").replace(/\0.*$/s, "");
      continue;
    }
    if (type !== "0" && type !== "\0") continue;
    files.set(name, Buffer.from(body));
  }
  return files;
}

async function fetchBuffer(url) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

/** The files of name@version as published, after checking the registry's integrity. */
const tarballs = new Map();
export async function npmFiles(name, version) {
  const key = `${name}@${version}`;
  if (tarballs.has(key)) return tarballs.get(key);
  const promise = (async () => {
    const meta = JSON.parse((await fetchBuffer(`https://registry.npmjs.org/${name.replace("/", "%2f")}/${encodeURIComponent(version)}`)).toString("utf8"));
    const { tarball, integrity } = meta.dist ?? {};
    if (!tarball || !/^sha512-/.test(integrity ?? "")) throw new Error(`${key}: the registry gives no sha512 integrity.`);
    mkdirSync(CACHE, { recursive: true });
    const cached = join(CACHE, `${key.replace(/[^\w.@-]/g, "_")}.tgz`);
    let data = existsSync(cached) ? readFileSync(cached) : null;
    const ok = (buf) => `sha512-${createHash("sha512").update(buf).digest("base64")}` === integrity;
    if (!data || !ok(data)) {
      data = await fetchBuffer(tarball);
      if (!ok(data)) throw new Error(`${key}: the tarball does not match the registry's integrity.`);
      writeFileSync(cached, data);
    }
    const out = new Map();
    // npm tarballs put everything under one top folder, usually package/.
    for (const [path, body] of untar(gunzipSync(data))) out.set(path.replace(/^[^/]+\//, ""), body);
    return out;
  })();
  tarballs.set(key, promise);
  return promise;
}

/** Published bytes for one lock entry: Map<package path, Buffer>. */
async function published(key, entry) {
  const source = parseSource(entry.from);
  if (!source) throw new Error(`"${entry.from}" is not npm:<name>@<version>/<path> or an https URL.`);
  const out = new Map();
  if (source.kind === "url") {
    if (key.endsWith("/")) throw new Error("A URL source registers one file, not a folder.");
    out.set(key, await fetchBuffer(source.url));
    return out;
  }
  const files = await npmFiles(source.name, source.version);
  if (key.endsWith("/")) {
    const folder = source.path.endsWith("/") ? source.path : `${source.path}/`;
    for (const [path, body] of files) if (path.startsWith(folder)) out.set(`${key}${path.slice(folder.length)}`, body);
  } else {
    if (!files.has(source.path)) throw new Error(`${source.name}@${source.version} has no ${source.path}.`);
    out.set(key, files.get(source.path));
  }
  return out;
}

export async function verifyPackage(id, findings) {
  const dir = packageDir(id);
  let lock;
  try {
    lock = readVendorLock(dir);
  } catch (error) {
    findings.error("vendor/lock", id, error.message, { file: VENDOR_LOCK });
    return;
  }
  const expected = new Map(vendorLockFiles(lock).map(([path, hash]) => [path, hash]));
  for (const [key, entry] of Object.entries(lock)) {
    if (typeof entry?.built === "string" && entry.from === undefined) {
      findings.review("vendor/built", id, `${key} was built locally (${entry.built}); check the recipe, it cannot be compared with a published package.`, { file: key });
      continue;
    }
    let files;
    try {
      files = await published(key, entry);
    } catch (error) {
      findings.error("vendor/source", id, `${key}: ${error.message}`, { file: VENDOR_LOCK });
      continue;
    }
    const registered = [...expected.keys()].filter((p) => (key.endsWith("/") ? p.startsWith(key) : p === key));
    for (const path of registered) {
      const body = files.get(path);
      if (!body) findings.error("vendor/mismatch", id, `${path} is not in ${entry.from}.`, { file: path });
      else if (sha256Hex(body) !== expected.get(path))
        findings.error("vendor/mismatch", id, `${path} is not the file published as ${entry.from}.`, { file: path });
    }
    if (!findings.items.some((f) => f.id === id && f.file?.startsWith(key) && f.level === "error"))
      findings.info("vendor/verified", id, `${key} matches ${entry.from}.`, { file: key });
  }
}

/** Register a file or a folder (key ending in /) after checking it against its source. */
export async function addEntry(id, key, from) {
  const dir = packageDir(id);
  const entry = { from };
  const files = await published(key, entry);
  if (key.endsWith("/")) {
    entry.files = {};
    const local = (rel) => readdirSync(join(dir, rel), { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? local(`${rel}${e.name}/`) : [`${rel}${e.name}`]);
    for (const path of local(key)) {
      const body = files.get(path);
      if (!body) throw new Error(`${path} is not in ${from}.`);
      const hash = sha256Hex(readFileSync(join(dir, path)));
      if (hash !== sha256Hex(body)) throw new Error(`${path} differs from ${from}.`);
      entry.files[path.slice(key.length)] = hash;
    }
  } else {
    const hash = sha256Hex(readFileSync(join(dir, key)));
    if (hash !== sha256Hex(files.get(key))) throw new Error(`${key} differs from ${from}.`);
    entry.sha256 = hash;
  }
  const lock = readVendorLock(dir);
  lock[key] = entry;
  const sorted = Object.fromEntries(Object.entries(lock).sort(([a], [b]) => (a < b ? -1 : 1)));
  mkdirSync(join(dir, dirname(VENDOR_LOCK)), { recursive: true });
  writeFileSync(join(dir, VENDOR_LOCK), `${JSON.stringify(sorted, null, 2)}\n`);
}

/** npm name@version pairs a package vendors. */
export function vendoredPackages(id) {
  const lock = readVendorLock(packageDir(id));
  const out = new Map();
  for (const entry of Object.values(lock)) {
    const source = typeof entry?.from === "string" ? parseSource(entry.from) : null;
    if (source?.kind === "npm") out.set(`${source.name}@${source.version}`, source);
  }
  return [...out.values()];
}

const SEVERE = new Set(["HIGH", "CRITICAL"]);

/** Known vulnerabilities (osv.dev) of the npm packages each id vendors. */
export async function osvCheck(ids, findings) {
  const queries = [];
  for (const id of ids) for (const p of vendoredPackages(id)) queries.push({ id, p });
  if (!queries.length) return;
  const response = await fetch("https://api.osv.dev/v1/querybatch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ queries: queries.map(({ p }) => ({ package: { name: p.name, ecosystem: "npm" }, version: p.version })) }),
  });
  if (!response.ok) throw new Error(`osv.dev: HTTP ${response.status}`);
  const { results } = await response.json();
  const details = new Map();
  for (const [i, result] of (results ?? []).entries()) {
    const { id, p } = queries[i];
    for (const { id: vuln } of result.vulns ?? []) {
      if (!details.has(vuln)) details.set(vuln, fetch(`https://api.osv.dev/v1/vulns/${vuln}`).then((r) => (r.ok ? r.json() : {})));
      const info = await details.get(vuln);
      const severity = String(info.database_specific?.severity ?? "").toUpperCase();
      const text = `${p.name}@${p.version}: ${vuln}${severity ? ` (${severity.toLowerCase()})` : ""} ${info.summary ?? ""}`.trim();
      // Documents are untrusted input: whether a document can reach the
      // vulnerable code is the reviewer's call.
      if (SEVERE.has(severity)) findings.review("vendor/vulnerability", id, text);
      else findings.info("vendor/vulnerability", id, text);
    }
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const findings = new Findings();
  if (command === "add") {
    const [id, key, from] = args;
    if (!id || !key || !from) throw new Error("Usage: vendor.mjs add <id> <path> <from>");
    await addEntry(id, key, from);
    console.log(`✓ ${id}: registered ${key} from ${from}`);
    return;
  }
  const ids = args.length ? args : packageIds().filter((id) => existsSync(join(packageDir(id), VENDOR_LOCK)));
  if (command === "verify") for (const id of ids) await verifyPackage(id, findings);
  else if (command === "osv") await osvCheck(ids, findings);
  else throw new Error("Usage: vendor.mjs verify|osv [id…] | add <id> <path> <from>");
  printFindings(findings.items);
  annotate(findings.items, packagePath);
  process.exit(findings.count("error") ? 1 : 0);
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  main().catch((error) => {
    console.error(error.message);
    process.exit(2);
  });
