const base64 = (data) => {
  let s = "";
  for (let i = 0; i < data.length; i += 16384)
    s += String.fromCharCode(...data.subarray(i, i + 16384));
  return btoa(s);
};
const bytes = (data) => Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
const folderMime = "application/vnd.google-apps.folder";
typora.sync.registerProvider(
  "google-drive",
  async ({ op, root, path = "", data, version, accessToken }) => {
    const api = "https://www.googleapis.com/drive/v3/files";
    async function request(url, method = "GET", headers = {}, body) {
      const result = await typora.net.fetch(url, {
        method,
        headers: { Authorization: `Bearer ${accessToken}`, ...headers },
        body,
      });
      if (!result.ok)
        throw {
          status: result.status,
          message: `Google Drive returned HTTP ${result.status}`,
          retryAfter: Number(result.headers.get("retry-after") || 0) * 1000,
        };
      return result;
    }
    async function list(parent) {
      let pageToken = "",
        all = [];
      do {
        const query = new URLSearchParams({
          q: `'${parent.replace(/'/g, "\\'")}' in parents and trashed = false`,
          fields: "nextPageToken,files(id,name,mimeType)",
          pageSize: "1000",
          ...(pageToken ? { pageToken } : {}),
        });
        const page = await (await request(api + "?" + query)).json();
        all.push(...page.files);
        pageToken = page.nextPageToken ?? "";
      } while (pageToken);
      const names = new Set();
      for (const file of all) {
        if (names.has(file.name))
          throw {
            status: 409,
            message:
              "Duplicate Google Drive names: resolve duplicates before syncing.",
          };
        names.add(file.name);
      }
      return all;
    }
    async function locate(relative) {
      let file = { id: root, mimeType: folderMime };
      for (const part of relative.split("/").filter(Boolean)) {
        file = (await list(file.id)).find((f) => f.name === part);
        if (!file) return null;
      }
      return file;
    }
    async function metadata(file) {
      const response = await request(
        api +
          "/" +
          encodeURIComponent(file.id) +
          "?fields=id,name,mimeType,version",
      );
      return {
        file: await response.json(),
        etag: response.headers.get("etag"),
      };
    }
    async function verifiedWrite(file, expected) {
      const before = await metadata(file);
      if (!before.etag)
        throw { status: 400, message: "Google Drive omitted ETag" };
      const body = await request(api + "/" + file.id + "?alt=media", "GET", {
        "If-Match": before.etag,
      });
      const actual = base64(new Uint8Array(await body.arrayBuffer()));
      const after = await metadata(file);
      if (before.etag !== after.etag || actual !== expected)
        throw { status: 412, message: "Remote changed after upload" };
      return before.etag;
    }
    try {
      if (op === "identify") {
        const { file } = await metadata({ id: root });
        if (file.mimeType !== folderMime)
          throw {
            status: 400,
            message: "Remote Folder must be a Google Drive folder ID",
          };
        return "google-drive:" + file.id;
      }
      const file = await locate(path);
      if (op === "stat") {
        if (!file) return null;
        const meta = await metadata(file);
        return {
          path,
          id: file.id,
          directory: file.mimeType === folderMime,
          version: meta.etag,
        };
      }
      if (op === "list") {
        if (!file) throw { status: 404, message: "Remote folder missing" };
        return (await list(file.id)).map((f) => ({
          path: [path, f.name].filter(Boolean).join("/"),
          id: f.id,
          directory: f.mimeType === folderMime,
          version: "",
        }));
      }
      if (op === "read") {
        if (!file) throw { status: 404, message: "Remote file missing" };
        if (file.mimeType.startsWith("application/vnd.google-apps."))
          throw {
            status: 400,
            message:
              "Google Docs must be exported to ordinary files before syncing",
          };
        const before = await metadata(file);
        if (!before.etag)
          throw {
            status: 400,
            message:
              "Google Drive omitted ETag; safe conditional sync is unavailable",
          };
        const body = await request(api + "/" + file.id + "?alt=media", "GET", {
          "If-Match": before.etag,
        });
        const after = await metadata(file);
        if (before.etag !== after.etag)
          throw { status: 412, message: "Remote changed during download" };
        return {
          data: base64(new Uint8Array(await body.arrayBuffer())),
          version: before.etag,
        };
      }
      if (op === "mkdir" && file?.mimeType === folderMime) return null;
      if (op === "remove") {
        if (!file) throw { status: 412, message: "File already removed" };
        await request(api + "/" + file.id, "DELETE", { "If-Match": version });
        return null;
      }
      if (op === "write" && version) {
        if (!file) throw { status: 412, message: "File removed" };
        await request(
          "https://www.googleapis.com/upload/drive/v3/files/" +
            file.id +
            "?uploadType=media",
          "PATCH",
          { "If-Match": version, "Content-Type": "application/octet-stream" },
          bytes(data),
        );
        return await verifiedWrite(file, data);
      }
      if (file) throw { status: 409, message: "File already exists" };
      const parts = path.split("/"),
        name = parts.pop(),
        parent = await locate(parts.join("/"));
      if (!parent) throw { status: 404, message: "Parent folder missing" };
      let created;
      if (op === "mkdir")
        created = await (
          await request(
            api,
            "POST",
            { "Content-Type": "application/json" },
            JSON.stringify({
              name,
              parents: [parent.id],
              mimeType: folderMime,
            }),
          )
        ).json();
      else if (op === "write") {
        const boundary = "typora_" + crypto.randomUUID();
        const header = new TextEncoder().encode(
          `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, parents: [parent.id] })}\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`,
        );
        const body = new Blob([header, bytes(data), `\r\n--${boundary}--`]);
        created = await (
          await request(
            "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
            "POST",
            { "Content-Type": `multipart/related; boundary=${boundary}` },
            body,
          )
        ).json();
      } else throw { status: 400, message: "Unknown operation" };
      // Drive allows duplicate names: detect concurrent creates and preserve both, never pick a winner.
      await list(parent.id);
      return op === "mkdir" ? null : await verifiedWrite(created, data);
    } catch (error) {
      return {
        error: {
          status: error.status ?? 500,
          message: error.message ?? String(error),
          retryAfter: error.retryAfter ?? 0,
        },
      };
    }
  },
);
