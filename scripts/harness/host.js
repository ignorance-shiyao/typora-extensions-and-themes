// The harness's stand-in for Typora, in the top page (scripts/harness/harness.mjs).
// It talks to an extension the way Typora does — the real Worker bootstrap
// and view SDK (runtime/), the real CSPs (server.mjs) — and answers with a
// fake document and no network, checking each call against the permissions
// like Typora's host (packages/workbench/src/extensions/workerHost.ts) and
// recording what the extension tried to do.

import { sanitizeRendererOutput } from "./sanitize.js";

/** In the fake document; seeing it leave in a request means the document is sent out. */
export const CANARY = "TYPORA-REVIEW-CANARY-7F3A";
const MARKDOWN = `# Review\n\nA paragraph with **bold**, a [link](https://example.com) and ${CANARY}.\n\n- one\n- two\n`;
const BLOCKS = [
  { id: "b1", type: "heading", level: 1, text: "Review" },
  { id: "b2", type: "paragraph", text: `A paragraph with bold, a link and ${CANARY}.` },
];
const THEME = { background: "#ffffff", foreground: "#24292f", panel: "#f6f8fa", border: "#d0d7de", dark: false };
const PANEL_THEME = {
  dark: false,
  vars: {
    "--typora-background": "#ffffff",
    "--typora-foreground": "#24292f",
    "--typora-panel": "#f6f8fa",
    "--typora-border": "#d0d7de",
    "--typora-accent": "#0a84ff",
    "--typora-font": "system-ui, sans-serif",
    "--typora-mono-font": "ui-monospace, monospace",
    "--typora-font-size": "14px",
    "--typora-editor-font-size": "17px",
  },
};

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const withTimeout = (promise, ms, what) =>
  Promise.race([promise, sleep(ms).then(() => Promise.reject(new Error(`${what} did not finish in ${ms / 1000} s`)))]);
const fromBase64 = (data) => (data ? new TextDecoder().decode(Uint8Array.from(atob(data), (c) => c.charCodeAt(0))) : "");

/** What one package did, filled in as it runs; returned to harness.mjs. */
function newRecord(id) {
  return { id, findings: [], requests: [], programs: [], logs: [], commands: [], activated: undefined, pages: 0, renders: 0, figures: [] };
}

function originAllowed(list, url) {
  let origin;
  try {
    origin = new URL(url).origin;
  } catch {
    return false;
  }
  return list.some((entry) => {
    if (/^\{config\./.test(entry)) return true;
    if (!entry.includes("*.")) return entry.replace(/\/$/, "") === origin;
    const [scheme, host] = entry.split("://*.");
    const u = new URL(origin);
    return `${u.protocol}` === `${scheme}:` && u.hostname.endsWith(`.${host.replace(/\/$/, "")}`);
  });
}

/** Typora's permission checks, plus the fake services behind them. */
function services(pkg, record, scope, bridge = null) {
  const perms = pkg.permissions;
  const storage = new Map();
  const deny = (what) => {
    record.findings.push({ level: "error", rule: "runtime/denied", message: `Called ${what} without the permission; Typora refuses it.` });
    throw new Error(`No ${what} permission.`);
  };
  const need = (kind) => {
    const ok =
      kind === "document:read" ? !!perms.document
      : kind === "document:write" ? perms.document === "write"
      : kind === "workspace" ? perms.workspace === "read"
      : kind === "network" ? !!perms.network?.length
      : !!perms[kind];
    if (!ok) deny(kind);
  };
  const fetchMock = ({ url, method, body }) => {
    need("network");
    if (!originAllowed(perms.network, url)) deny(`network to ${url}`);
    const text = typeof body === "string" ? fromBase64(body) : "";
    record.requests.push(`${method ?? "GET"} ${url}${text ? ` (${text.length} B)` : ""}`);
    if (text.includes(CANARY) || String(url).includes(CANARY))
      record.findings.push({ level: "review", rule: "runtime/sends-document", message: `Sends document content to ${new URL(url).origin}.` });
    return { status: 503, statusText: "No network in the store review", url, headers: {}, body: "" };
  };
  const spawn = (request) => {
    need("process");
    const command = typeof request?.command === "string" ? request.command : JSON.stringify(request?.command);
    record.programs.push(`${command} ${(request?.args ?? []).join(" ")}`.trim());
    throw new Error("Programs do not run in the store review.");
  };
  return {
    "editor.getSelection": () => (need("document:read"), { from: 0, to: 0, text: "" }),
    "editor.getMarkdown": () => (need("document:read"), MARKDOWN),
    "editor.insertMarkdown": () => need("document:write"),
    "editor.replaceRange": () => need("document:write"),
    "editor.replaceDocument": () => need("document:write"),
    "document.info": () => ({ name: "review.md", path: null, dirty: false }),
    "document.getBlocks": () => (need("document:read"), BLOCKS),
    "document.readImage": () => (need("document:read"), Promise.reject(new Error("No such image."))),
    "publish.current": () => (need("document:read"), { markdown: MARKDOWN, title: "Review" }),
    "sync.statusChanged": () => need("workspace"),
    "storage.get": (key) => storage.get(`s:${key}`) ?? null,
    "storage.set": ({ key, value }) => void storage.set(`s:${key}`, value),
    "storage.remove": (key) => void storage.delete(`s:${key}`),
    "storage.keys": () => [...storage.keys()].filter((k) => k.startsWith("s:")).map((k) => k.slice(2)),
    "storage.compareAndSet": ({ key, expect, value }) => {
      if ((storage.get(`s:${key}`) ?? null) !== expect) return false;
      storage.set(`s:${key}`, value);
      return true;
    },
    "secrets.get": (key) => storage.get(`k:${key}`) ?? null,
    "secrets.set": ({ key, value }) => void storage.set(`k:${key}`, value),
    "secrets.delete": (key) => void storage.delete(`k:${key}`),
    "secrets.keys": () => [...storage.keys()].filter((k) => k.startsWith("k:")).map((k) => k.slice(2)),
    "files.read": () => Promise.reject(new Error("No such file.")),
    "files.write": () => undefined,
    "files.delete": () => undefined,
    "files.list": () => [],
    "net.fetch": fetchMock,
    // main ↔ background, like Typora's runtime router.
    "runtime.connect": () => {
      const other = bridge?.background;
      if (scope !== "main" || !other) throw new Error("No background to connect to.");
      const portId = `port${++bridge.next}`;
      bridge.ports.set(portId, { main: bridge.main, background: other });
      other.postMessage({ t: "event", type: "runtime.connected", payload: { portId, remote: "review" } });
      return { portId, remote: "background" };
    },
    "runtime.portPost": ({ portId, message }) => {
      const ends = bridge?.ports.get(portId);
      ends?.[scope === "main" ? "background" : "main"]?.postMessage({ t: "event", type: "runtime.portMessage", payload: { portId, message } });
    },
    "runtime.portClose": ({ portId }) => {
      const ends = bridge?.ports.get(portId);
      bridge?.ports.delete(portId);
      ends?.[scope === "main" ? "background" : "main"]?.postMessage({ t: "event", type: "runtime.portClosed", payload: { portId } });
    },
    "runtime.windows": () => ["review"],
    "runtime.lock": () => "lock",
    "runtime.unlock": () => undefined,
    "runtime.readAsset": async (path) => {
      const response = await fetch(`/ext/${pkg.id}/${String(path).replace(/^\/+/, "")}`);
      if (!response.ok) throw new Error(`${path} is not in the package.`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(binary);
    },
    "alarms.create": () => {
      if (scope !== "background") throw new Error("Alarms are for background.");
    },
    "alarms.clear": () => undefined,
    "clipboard.readText": () => (need("clipboard"), ""),
    "clipboard.writeText": () => need("clipboard"),
    "ai.status": () => (need("ai"), { ready: false, problem: "No model in the store review.", model: "" }),
    "ai.complete": () => (need("ai"), Promise.reject(new Error("No model in the store review."))),
    "ui.toast": (message) => void record.logs.push(`toast: ${message}`),
    "ui.quickPick": () => null,
    "ui.input": () => null,
    "ui.confirm": () => false,
    "workspace.folders": () => (need("workspace"), []),
    "workspace.listFiles": () => (need("workspace"), []),
    "workspace.readFile": () => (need("workspace"), Promise.reject(new Error("No such file."))),
    "process.info": () => (need("process"), { os: "linux", arch: "x64", shell: "/bin/sh" }),
    "process.spawn": spawn,
    "process.list": () => (need("process"), []),
    "process.attach": () => Promise.reject(new Error("No such program.")),
    "process.detach": () => undefined,
    "process.write": () => undefined,
    "process.resize": () => undefined,
    "process.kill": () => undefined,
    "commands.execute": () => undefined,
    "views.post": () => undefined,
    // Pages.
    settings: () => ({ ...pkg.settings }),
    fetch: fetchMock,
    getState: () => null,
    setState: () => undefined,
    postMessage: () => undefined,
    reveal: () => undefined,
    insertMarkdown: () => (need("document:write"), true),
    save: () => undefined,
    "ui.copy": () => undefined,
    "ui.toolbar": () => undefined,
    "ui.exitFullsize": () => undefined,
  };
}

/** Answer a request with a service, or refuse what Typora does not have. */
async function answer(handlers, record, type, payload) {
  const handler = handlers[type];
  if (!handler) {
    record.findings.push({ level: "warn", rule: "runtime/unknown-request", message: `Asked for ${type}, which Typora does not offer.` });
    throw new Error(`Unknown request ${type}.`);
  }
  return handler(payload);
}

/** Start `main` or `background` in its Worker and wait for activate(); returns { ok, stop }. */
async function startWorker(pkg, record, scope, bridge) {
  const entry = scope === "main" ? pkg.main : pkg.background;
  const handlers = services(pkg, record, scope, bridge);
  const worker = new Worker(`/app/extension-worker.js?ext=${encodeURIComponent(pkg.id)}`, { name: `${pkg.id} (${scope})` });
  bridge[scope] = worker;
  let settle;
  const done = new Promise((resolve) => (settle = resolve));
  const deactivated = new Promise((resolve) => {
    worker.addEventListener("message", ({ data }) => data?.t === "event" && data.type === "deactivated" && resolve());
  });
  worker.addEventListener("error", (event) => {
    record.findings.push({ level: "error", rule: "runtime/worker", message: `${scope} Worker failed: ${event.message ?? "error"}` });
    settle(false);
  });
  worker.addEventListener("message", async ({ data: message }) => {
    if (!message || typeof message !== "object") return;
    if (message.t === "event") {
      const { type, payload } = message;
      if (type === "booted")
        worker.postMessage({
          t: "init",
          extension: { id: pkg.id, name: pkg.name, version: pkg.version },
          scope,
          entryUrl: new URL(`/ext/${pkg.id}/${entry}`, location.href).href,
          settings: { ...pkg.settings },
          messages: {},
          env: { platform: "linux", locale: "en", appearance: "light" },
        });
      else if (type === "activated") settle(true);
      else if (type === "failed") {
        record.findings.push({ level: "error", rule: "runtime/activate", message: `${scope}: activate() failed: ${String(payload).split("\n").slice(0, 4).join(" ")}` });
        settle(false);
      } else if (type === "log") {
        record.logs.push(`${scope} ${payload?.level}: ${payload?.message}`);
        if (payload?.level === "error")
          record.findings.push({ level: "error", rule: "runtime/error", message: `${scope}: ${String(payload.message).slice(0, 300)}` });
      } else if (type === "commands.registered" && scope === "main") record.commands.push(String(payload));
      return;
    }
    if (message.t === "req") {
      try {
        const value = await answer(handlers, record, message.type, message.payload);
        worker.postMessage({ t: "res", id: message.id, ok: true, value });
      } catch (error) {
        worker.postMessage({ t: "res", id: message.id, ok: false, error: error?.message ?? String(error) });
      }
    }
  });
  const ok = await withTimeout(done, 10000, `${scope} activate()`).catch((error) => {
    record.findings.push({ level: "error", rule: "runtime/activate", message: error.message });
    return false;
  });
  const stop = async () => {
    // Typora disposes everything on disable: deactivate() has to return.
    worker.postMessage({ t: "event", type: "deactivate" });
    await withTimeout(deactivated, 5000, `${scope} deactivate()`).catch((error) =>
      record.findings.push({ level: "warn", rule: "runtime/deactivate", message: error.message }));
    worker.terminate();
  };
  return { ok, stop };
}

/** Open a page the way PanelConnection does and return a request function. */
async function openPage(pkg, record, entry, kind) {
  const handlers = services(pkg, record, "page");
  const frame = document.createElement("iframe");
  frame.setAttribute("sandbox", "allow-scripts");
  frame.title = `${pkg.id} ${entry}`;
  // Static renderers are hidden in Typora too; views get the store screenshot's size.
  frame.style.cssText = kind === "renderer" ? "width:880px;height:0;border:0;display:block" : "width:880px;height:550px;border:1px solid #ccc;display:block;margin:8px 0;background:#fff";
  frame.src = `/ext/${pkg.id}/${entry}`;
  document.getElementById("pages").append(frame);
  const pending = new Map();
  let next = 1;
  let port;
  const ready = new Promise((resolve) => {
    frame.addEventListener("load", () => {
      const channel = new MessageChannel();
      port = channel.port1;
      port.onmessage = async ({ data: message }) => {
        if (!message || typeof message !== "object") return;
        if (message.t === "event") {
          if (message.type === "ready") resolve();
          if (message.type === "log") record.logs.push(`page: ${message.payload}`);
        } else if (message.t === "res") {
          const p = pending.get(message.id);
          pending.delete(message.id);
          if (message.ok) p?.resolve(message.value);
          else p?.reject(new Error(String(message.error)));
        } else if (message.t === "req") {
          try {
            port.postMessage({ t: "res", id: message.id, ok: true, value: await answer(handlers, record, message.type, message.payload) });
          } catch (error) {
            port.postMessage({ t: "res", id: message.id, ok: false, error: error?.message ?? String(error) });
          }
        }
      };
      frame.contentWindow.postMessage({ typora: "connect", kind, extension: pkg.id, capabilities: { toolbar: false }, theme: PANEL_THEME }, "*", [channel.port2]);
    });
  });
  await withTimeout(ready, 10000, `${entry} (ready)`);
  record.pages++;
  return {
    frame,
    request: (type, payload, ms = 15000) =>
      withTimeout(new Promise((resolve, reject) => {
        const id = next++;
        pending.set(id, { resolve, reject });
        port.postMessage({ t: "req", id, type, payload });
      }), ms, `${type}`),
    emit: (type, payload) => port.postMessage({ t: "event", type, payload }),
  };
}

/** Inputs a renderer must survive: documents are untrusted. */
const FUZZ = [
  "",
  "\u0000￿\uD800",
  "</script><script>alert(1)</script>",
  '{"__proto__": {"polluted": true}}',
  `${"(".repeat(2000)}${")".repeat(2000)}`,
  "a".repeat(300000),
];

/** Count elements, to see what the sanitizer removes. */
const elementCount = (markup, type) => {
  const doc = new DOMParser().parseFromString(markup, type);
  return doc.getElementsByTagName("*").length;
};

async function renderFence(pkg, record, contribution) {
  const interactive = contribution.mode === "interactive";
  const lang = contribution.lang?.[0] ?? "";
  const fixtures = pkg.fixtures.filter((f) => contribution.lang?.includes(f.lang));
  const render = async (page, source, purpose) => {
    if (!interactive) return page.request("render", { source, info: lang, lang, theme: THEME, purpose });
    page.emit("open", { source, info: lang, lang, purpose: "export" });
    return page.request("snapshot");
  };
  const fresh = () => openPage(pkg, record, contribution.entry, interactive ? "fence" : "renderer");
  let page = await fresh();
  let rendered = null;
  for (const fixture of fixtures) {
    if (interactive) page = await fresh();
    try {
      const output = await render(page, fixture.source, "view");
      record.renders++;
      const raw = output?.svg ?? output?.html ?? "";
      const clean = sanitizeRendererOutput(output);
      const type = output?.svg !== undefined ? "image/svg+xml" : "text/html";
      const before = elementCount(raw, type);
      const after = elementCount(clean, type);
      if (after < before * 0.9)
        record.findings.push({ level: "warn", rule: "runtime/sanitized", file: fixture.file, message: `${lang} example ${fixture.index}: Typora's sanitizer removed ${before - after} of ${before} elements; the drawing will look different in the editor.` });
      record.figures.push({ title: `${lang} · ${fixture.file} #${fixture.index}`, markup: clean });
      rendered ??= fixture;
    } catch (error) {
      record.findings.push({ level: "error", rule: "runtime/render", file: fixture.file, message: `${lang} example ${fixture.index}: ${error.message}` });
    }
  }
  if (!fixtures.length)
    record.findings.push({ level: "warn", rule: "runtime/no-fixture", message: `No ${lang} example to render: add one to snippets/ or .typora/fixtures/.` });
  // Untrusted input: an error is fine, a hang or a dead page is not.
  for (const source of FUZZ) {
    if (interactive) page = await fresh();
    try {
      const output = await render(page, source, "view");
      if (output) sanitizeRendererOutput(output);
    } catch (error) {
      if (/did not finish/.test(error.message))
        record.findings.push({ level: "error", rule: "runtime/hang", message: `${lang}: a ${source.length}-character input never finished rendering.` });
    }
  }
  try {
    if (rendered && !interactive) await render(page, rendered.source, "view");
  } catch (error) {
    record.findings.push({ level: "error", rule: "runtime/hang", message: `${lang}: stops rendering after untrusted input (${error.message}).` });
  }
}

/** Run one package; called by harness.mjs. */
window.runPackage = async (pkg) => {
  const record = newRecord(pkg.id);
  try {
    // Background first: main may connect to it while activating.
    const bridge = { next: 0, ports: new Map(), main: null, background: null };
    const running = [];
    if (pkg.background) {
      const background = await startWorker(pkg, record, "background", bridge);
      running.push(background);
      record.activated = background.ok;
    }
    if (pkg.main) {
      const main = await startWorker(pkg, record, "main", bridge);
      running.push(main);
      record.activated = (record.activated ?? true) && main.ok;
      for (const command of pkg.commands)
        if (!record.commands.includes(command))
          record.findings.push({ level: "error", rule: "runtime/command", message: `contributes.commands lists ${command}, but main never registers it; the menu item would do nothing.` });
      for (const command of record.commands)
        if (!pkg.commands.includes(command))
          record.findings.push({ level: "warn", rule: "runtime/command", message: `main registers ${command}, which contributes.commands does not list.` });
    }
    for (const worker of running.reverse()) await worker.stop();
    for (const contribution of pkg.fenceRenderers) await renderFence(pkg, record, contribution).catch((error) =>
      record.findings.push({ level: "error", rule: "runtime/page", file: contribution.entry, message: error.message }));
    for (const view of pkg.views) {
      try {
        const page = await openPage(pkg, record, view.entry, view.kind);
        if (view.kind === "detail" && pkg.permissions.document) page.emit("document", { blocks: BLOCKS });
        await sleep(500);
      } catch (error) {
        record.findings.push({ level: "error", rule: "runtime/page", file: view.entry, message: error.message });
      }
    }
  } catch (error) {
    record.findings.push({ level: "error", rule: "runtime/harness", message: error?.message ?? String(error) });
  }
  // The rendered drawings, for the screenshot.
  const gallery = document.getElementById("figures");
  for (const f of record.figures) {
    const figure = document.createElement("figure");
    figure.innerHTML = f.markup;
    const caption = document.createElement("figcaption");
    caption.textContent = f.title;
    figure.append(caption);
    gallery.append(figure);
  }
  delete record.figures;
  return record;
};
