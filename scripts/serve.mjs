#!/usr/bin/env node
// Serve dist/ like the Worker does (same headers, trailing-slash redirects,
// 404 page) on http://localhost:8788. No wrangler needed, works offline.
// Point Typora at it with TYPORA_EXTENSIONS_STORE=http://localhost:8788.

import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { CORS_HEADERS, PACKAGE_CONTENT_TYPE, PACKAGE_EXTENSION, SECURITY_HEADERS, cacheControlFor } from "../headers.js";
import { ROOT } from "./lib.mjs";

const DIST = join(ROOT, "dist");
const PORT = Number(process.env.PORT ?? 8788);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  [PACKAGE_EXTENSION]: PACKAGE_CONTENT_TYPE,
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

if (!existsSync(join(DIST, "index.json"))) {
  console.error("dist/ is empty. Run npm run build first.");
  process.exit(1);
}

const isFile = (path) => existsSync(path) && statSync(path).isFile();

createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const headers = { ...CORS_HEADERS, ...SECURITY_HEADERS };
  if (req.method === "OPTIONS") {
    res.writeHead(204, headers).end();
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { ...headers, allow: "GET, HEAD, OPTIONS" }).end("Method Not Allowed");
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    pathname = "/";
  }
  const rel = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  let file = join(DIST, rel);
  let status = 200;
  if (!file.startsWith(DIST)) file = join(DIST, "404.html");

  if (pathname.endsWith("/")) file = join(file, "index.html");
  else if (!isFile(file) && isFile(join(file, "index.html"))) {
    // Workers assets "auto-trailing-slash": /typora.kroki → /typora.kroki/
    res.writeHead(307, { ...headers, location: `${url.pathname}/${url.search}` }).end();
    log(req, 307);
    return;
  } else if (pathname.endsWith("/index.html") && isFile(file)) {
    res.writeHead(307, { ...headers, location: url.pathname.replace(/index\.html$/, "") }).end();
    log(req, 307);
    return;
  }
  if (!isFile(file)) {
    file = join(DIST, "404.html");
    status = 404;
  }

  const body = readFileSync(file);
  const type = TYPES[extname(file)] ?? "application/octet-stream";
  const cacheControl = cacheControlFor(url.pathname, status, type);
  res.writeHead(status, {
    ...headers,
    "content-type": type,
    "content-length": body.length,
    ...(cacheControl ? { "cache-control": cacheControl } : {}),
  });
  res.end(req.method === "HEAD" ? undefined : body);
  log(req, status);
}).listen(PORT, () => console.log(`Store at http://localhost:${PORT}  (TYPORA_EXTENSIONS_STORE=http://localhost:${PORT})`));

function log(req, status) {
  console.log(`${status} ${req.method} ${req.url}`);
}
