// The harness's web server: Typora's extension origin and app origin over
// HTTP on 127.0.0.1, with the CSPs the app sends (runtime/csp.json). Only the
// files that go into the package are served, so whatever the package lacks
// (dotfiles, store images, case mismatches) fails here as it would for users.

import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { packageDir, packageFiles } from "../lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const CSP = JSON.parse(readFileSync(join(here, "runtime", "csp.json"), "utf8"));
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".wasm": "application/wasm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

const HOST_PAGE = `<!doctype html><meta charset="utf-8"><title>Store review</title>
<style>body{font:14px system-ui;margin:16px;background:#fff;color:#222}figure{display:inline-block;margin:8px;padding:8px;border:1px solid #ddd;max-width:840px;vertical-align:top}figure svg{max-width:820px;height:auto}figcaption{color:#666;font-size:12px}</style>
<div id="pages"></div><div id="figures"></div>
<script type="module">import "/app/host.js"; window.hostReady = true;</script>`;

export function startServer(ids) {
  const files = new Map(ids.map((id) => [id, new Set(packageFiles(packageDir(id)))]));
  const server = createServer((req, res) => {
    const origin = `http://${req.headers.host}`;
    const url = new URL(req.url, origin);
    const send = (status, type, body, headers = {}) => {
      res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store", ...headers });
      res.end(body);
    };
    if (url.pathname === "/app/host.html") return send(200, TYPES[".html"], HOST_PAGE);
    if (url.pathname === "/app/host.js") return send(200, TYPES[".js"], readFileSync(join(here, "host.js")));
    if (url.pathname === "/app/sanitize.js") return send(200, TYPES[".js"], readFileSync(join(here, "runtime", "sanitize.js")));
    if (url.pathname === "/app/extension-worker.js") {
      const id = url.searchParams.get("ext");
      if (!files.has(id)) return send(400, "text/plain", "Unknown extension.");
      return send(200, TYPES[".js"], readFileSync(join(here, "runtime", "extension-worker.js")), {
        "Content-Security-Policy": CSP.worker.replaceAll("{base}", `${origin}/ext/${id}/`),
      });
    }
    const m = /^\/ext\/([^/]+)\/(.+)$/.exec(url.pathname);
    if (!m || !files.has(m[1])) return send(404, "text/plain", "Not found.");
    const [, id, raw] = m;
    let path;
    try {
      path = decodeURIComponent(raw);
    } catch {
      return send(400, "text/plain", "Bad path.");
    }
    const cors = { "Access-Control-Allow-Origin": "*" };
    if (path === "__typora/view.js" || path.endsWith("/__typora/view.js"))
      return send(200, TYPES[".js"], readFileSync(join(here, "runtime", "view.js")), cors);
    if (!files.get(id).has(path)) return send(404, "text/plain", "Not in the package.", cors);
    const type = TYPES[extname(path).toLowerCase()] ?? "application/octet-stream";
    const headers = { ...cors };
    if (type.startsWith("text/html")) headers["Content-Security-Policy"] = CSP.page.replaceAll("{base}", `${origin}/ext/${id}/`);
    return send(200, type, readFileSync(join(packageDir(id), path)), headers);
  });
  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve({ origin: `http://127.0.0.1:${server.address().port}`, close: () => server.close() })));
}
