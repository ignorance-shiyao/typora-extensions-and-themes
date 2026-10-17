// extensions.typora.io: static assets from ./dist (built by scripts/build.mjs)
// plus the headers in headers.js. wrangler.toml sets run_worker_first so
// every response, including assets and the 404 page, passes through here.

import { CORS_HEADERS, PACKAGE_CONTENT_TYPE, PACKAGE_EXTENSION, SECURITY_HEADERS, cacheControlFor } from "./headers.js";

const isLocal = (host) => host === "localhost" || host === "127.0.0.1" || host === "[::1]";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (env.CANONICAL_HOST && url.hostname !== env.CANONICAL_HOST && !isLocal(url.hostname)) {
      url.hostname = env.CANONICAL_HOST;
      url.protocol = "https:";
      url.port = "";
      return Response.redirect(url.toString(), 301);
    }
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
    if (request.method !== "GET" && request.method !== "HEAD")
      return new Response("Method Not Allowed", { status: 405, headers: { ...CORS_HEADERS, allow: "GET, HEAD, OPTIONS" } });

    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries({ ...CORS_HEADERS, ...SECURITY_HEADERS })) headers.set(name, value);
    // The asset server doesn't know the package type.
    if (response.ok && url.pathname.endsWith(PACKAGE_EXTENSION)) headers.set("content-type", PACKAGE_CONTENT_TYPE);
    const cacheControl = cacheControlFor(url.pathname, response.status, headers.get("content-type") ?? "");
    if (cacheControl) headers.set("cache-control", cacheControl);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
};
