// Response headers shared by worker.js (production) and scripts/serve.mjs
// (local dev), so both serve the store the same way.

const FIVE_MINUTES = 60 * 5;
const ONE_HOUR = 60 * 60;
const ONE_YEAR = 60 * 60 * 24 * 365;

/** The app fetches the catalog and downloads cross-origin from its renderer / host. */
export const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, HEAD, OPTIONS",
  "access-control-max-age": "86400",
};

export const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
};

/**
 * Cache policy:
 * - /index.json changes on every publish: short cache.
 * - /download/<id>-<version>.zip is never rewritten (a change needs a new
 *   version, enforced by scripts/permission-diff.mjs): immutable.
 * - /assets/* names carry a content hash: immutable.
 * - HTML revalidates every time.
 */
export function cacheControlFor(pathname, status, contentType = "") {
  if (status === 404) return `public, max-age=${FIVE_MINUTES}`;
  if (status !== 200 && status !== 304) return null;
  if (pathname === "/index.json") return `public, max-age=${FIVE_MINUTES}`;
  if (pathname.startsWith("/download/") || pathname.startsWith("/assets/"))
    return `public, max-age=${ONE_YEAR}, immutable`;
  if (pathname === "/robots.txt" || pathname === "/sitemap.xml") return `public, max-age=${ONE_HOUR}`;
  if (contentType.includes("text/html")) return "public, max-age=0, must-revalidate";
  return `public, max-age=${ONE_HOUR}`;
}
