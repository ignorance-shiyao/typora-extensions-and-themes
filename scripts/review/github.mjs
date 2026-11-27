// The few GitHub REST calls the review workflows make, with the workflow's
// GITHUB_TOKEN. Everything read from a pull request (body, files, manifests)
// is data.

const API = process.env.GITHUB_API_URL ?? "https://api.github.com";

export function repo() {
  const name = process.env.GITHUB_REPOSITORY;
  if (!name) throw new Error("GITHUB_REPOSITORY is not set.");
  return name;
}

export async function gh(path, { method = "GET", body } = {}) {
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is not set.");
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(`${method} ${path}: HTTP ${response.status} ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}

/** Every page of a list endpoint. */
export async function ghAll(path, limit = 30) {
  const out = [];
  for (let page = 1; page <= limit; page++) {
    const sep = path.includes("?") ? "&" : "?";
    const items = await gh(`${path}${sep}per_page=100&page=${page}`);
    out.push(...items);
    if (items.length < 100) break;
  }
  return out;
}

/** A file of the pull request's head, as text, or null when it is not there. */
export async function fileAt(path, ref) {
  try {
    const item = await gh(`/repos/${repo()}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${ref}`);
    return Buffer.from(item.content ?? "", "base64").toString("utf8");
  } catch (error) {
    if (/HTTP 404/.test(error.message)) return null;
    throw error;
  }
}

/** Create or update the comment that starts with `marker`. */
export async function upsertComment(number, marker, body) {
  const comments = await ghAll(`/repos/${repo()}/issues/${number}/comments`);
  const mine = comments.find((c) => c.user?.type === "Bot" && c.body?.startsWith(marker));
  const text = `${marker}\n${body}`;
  if (mine) await gh(`/repos/${repo()}/issues/comments/${mine.id}`, { method: "PATCH", body: { body: text } });
  else await gh(`/repos/${repo()}/issues/${number}/comments`, { method: "POST", body: { body: text } });
}

/** Make the pull request carry exactly `wanted` of the labels this tool manages. */
export async function syncLabels(number, current, wanted, managed) {
  const add = wanted.filter((l) => !current.includes(l));
  const remove = current.filter((l) => managed(l) && !wanted.includes(l));
  if (add.length) await gh(`/repos/${repo()}/issues/${number}/labels`, { method: "POST", body: { labels: add } });
  for (const label of remove)
    await gh(`/repos/${repo()}/issues/${number}/labels/${encodeURIComponent(label)}`, { method: "DELETE" }).catch(() => {});
}

/** Markdown-safe text from a pull request (no mentions, no HTML, no table breaks). */
export function md(text) {
  return String(text ?? "")
    .replace(/[\\`*_{}[\]<>|#]/g, (c) => `\\${c}`)
    .replace(/@/g, "@​")
    .replace(/\r?\n/g, " ");
}
