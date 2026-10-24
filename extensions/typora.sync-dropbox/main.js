const bytes = (data) => Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
const base64 = (data) => {
  let s = "";
  for (let i = 0; i < data.length; i += 16384)
    s += String.fromCharCode(...data.subarray(i, i + 16384));
  return btoa(s);
};
typora.sync.registerProvider("dropbox", async (request) => {
  const { op, root, path = "", accessToken, data, version } = request;
  const target = root.replace(/\/$/, "") + (path ? "/" + path : "") || "";
  async function call(method, args, content) {
    const headers = { Authorization: `Bearer ${accessToken}` };
    let body,
      host = "https://api.dropboxapi.com/2/";
    if (content !== undefined) {
      host = "https://content.dropboxapi.com/2/";
      headers["Dropbox-API-Arg"] = JSON.stringify(args).replace(
        /[\u007f-\uffff]/g,
        (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"),
      );
      if (content !== null) {
        headers["Content-Type"] = "application/octet-stream";
        body = bytes(content);
      }
    } else {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(args);
    }
    const response = await typora.net.fetch(host + method, {
      method: "POST",
      headers,
      body,
    });
    if (!response.ok) {
      const error = await response.json();
      throw {
        status: response.status,
        message: error.error_summary ?? "Dropbox request failed",
        retryAfter: Number(response.headers.get("retry-after") || 0) * 1000,
      };
    }
    if (method === "files/download")
      return {
        data: base64(new Uint8Array(await response.arrayBuffer())),
        version: JSON.parse(response.headers.get("dropbox-api-result")).rev,
      };
    return response.json();
  }
  const metadata = async () => {
    try {
      return await call("files/get_metadata", { path: target });
    } catch (e) {
      if (e.status === 409 && e.message.startsWith("path/not_found"))
        return null;
      throw e;
    }
  };
  try {
    if (op === "identify") {
      const user = await call("users/get_current_account", null);
      const folder = root ? await metadata() : { id: "root", ".tag": "folder" };
      if (!folder || folder[".tag"] !== "folder")
        throw { status: 400, message: "Select an existing Dropbox folder" };
      return user.account_id + ":" + folder.id;
    }
    if (op === "stat") {
      if (!target) return {path, id: "root", directory: true, version: ""};
      const file = await metadata();
      return (
        file && {
          path,
          id: file.id,
          directory: file[".tag"] === "folder",
          version: file.rev ?? "",
        }
      );
    }
    if (op === "list") {
      const all = [];
      let page = await call("files/list_folder", {
        path: target,
        recursive: false,
        include_deleted: false,
      });
      while (true) {
        all.push(
          ...page.entries.map((f) => ({
            path: [path, f.name].filter(Boolean).join("/"),
            directory: f[".tag"] === "folder",
            version: f.rev ?? "",
            id: f.id,
          })),
        );
        if (!page.has_more) return all;
        page = await call("files/list_folder/continue", {
          cursor: page.cursor,
        });
      }
    }
    if (op === "read")
      return await call("files/download", { path: target }, null);
    if (op === "write")
      return (
        await call(
          "files/upload",
          {
            path: target,
            mode: version
              ? { ".tag": "update", update: version }
              : { ".tag": "add" },
            autorename: false,
            strict_conflict: true,
            mute: true,
          },
          data,
        )
      ).rev;
    if (op === "remove") {
      await call("files/delete_v2", { path: target, parent_rev: version });
      return null;
    }
    if (op === "mkdir") {
      const file = await metadata();
      if (file?.[".tag"] === "folder") return null;
      await call("files/create_folder_v2", { path: target, autorename: false });
      return null;
    }
    throw { status: 400, message: "Unknown sync operation" };
  } catch (error) {
    return {
      error: {
        status: error.status ?? 500,
        message: error.message ?? String(error),
        retryAfter: error.retryAfter ?? 0,
      },
    };
  }
});
