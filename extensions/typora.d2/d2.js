// D2 — a static fence renderer (docs/extensions.md §6.3): runs the d2
// program on this computer (`d2 - -`: source on stdin, SVG on stdout), or
// posts the source to a Kroki server, as set in the extension's options.

const view = typora.view;

const RENDER_TIMEOUT_MS = 20_000;

async function settings() {
  const raw = await view.settings();
  const text = (key, fallback) => (typeof raw[key] === "string" && raw[key].trim() ? raw[key].trim() : fallback);
  return {
    backend: raw.backend === "kroki" ? "kroki" : "command",
    command: text("command", "d2"),
    layout: raw.layout === "elk" ? "elk" : "dagre",
    sketch: raw.sketch === true,
    server: text("server", "https://kroki.io").replace(/\/+$/, ""),
  };
}

/** Whether the source's `vars: { d2-config: … }` sets `key` (command-line flags would override it). */
const configures = (source, key) => new RegExp(String.raw`(^|[\s{;])${key}\s*:`, "m").test(source);

/** Run `command args` with `input` on stdin; resolves with what it printed. */
async function run(command, args, input) {
  let handle;
  try {
    handle = await view.process.spawn(command, args, { name: "d2" });
  } catch (error) {
    throw new Error(`Could not run ${command}: ${error.message}`);
  }
  const stdout = [];
  let stderr = "";
  const decoder = new TextDecoder();
  handle.onData((bytes, stream) => {
    if (stream === "stderr") stderr += decoder.decode(bytes, { stream: true });
    else stdout.push(bytes);
  });
  const exit = new Promise((resolve) => handle.onExit(resolve));
  const timer = setTimeout(() => void handle.kill().catch(() => {}), RENDER_TIMEOUT_MS);
  try {
    await handle.write(input);
    await handle.end();
    const { code, signal } = await exit;
    const output = new Uint8Array(stdout.reduce((n, part) => n + part.length, 0));
    let offset = 0;
    for (const part of stdout) {
      output.set(part, offset);
      offset += part.length;
    }
    return { code, signal, stdout: new TextDecoder().decode(output), stderr };
  } finally {
    clearTimeout(timer);
  }
}

async function localRender(config, source, theme) {
  const args = [];
  if (!configures(source, "theme-id")) args.push(`--theme=${theme.dark ? 200 : 0}`);
  if (!configures(source, "pad")) args.push("--pad=24");
  if (!configures(source, "layout-engine")) args.push(`--layout=${config.layout}`);
  if (config.sketch && !configures(source, "sketch")) args.push("--sketch");
  args.push("-", "-");
  const result = await run(config.command, args, source.endsWith("\n") ? source : `${source}\n`);
  if (result.signal) throw new Error("d2 took too long and was stopped.");
  if (result.code !== 0 || !result.stdout.includes("<svg")) {
    // "err: failed to compile -: -:1:1: connection missing destination"
    const lines = result.stderr
      .split("\n")
      .map((line) => line.replace(/^err:\s*/, "").replace(/^failed to compile -:\s*/, "").replace(/^-:(\d+):(\d+):/, "Line $1:$2:").trim())
      .filter((line) => line && !/^(success|info):/.test(line));
    throw new Error(lines.join("\n") || `d2 exited with code ${result.code}.`);
  }
  return result.stdout.slice(result.stdout.indexOf("<svg"));
}

async function krokiRender(config, source) {
  let response;
  try {
    response = await view.fetch(`${config.server}/d2/svg`, {
      method: "POST",
      headers: { "Content-Type": "text/plain; charset=utf-8", Accept: "image/svg+xml" },
      body: source,
    });
  } catch (error) {
    throw new Error(`${error.message} (Kroki server ${config.server})`);
  }
  const text = await response.text();
  if (!response.ok) throw new Error(text.trim().split("\n")[0] || `${config.server} answered ${response.status}.`);
  return text;
}

/**
 * D2's outer <svg> has a viewBox but no size, so it would stretch to the
 * page's width: give it the size the diagram was drawn at.
 */
function sized(svg) {
  const start = svg.indexOf("<svg");
  const end = svg.indexOf(">", start);
  const tag = svg.slice(start, end);
  if (/\swidth=/.test(tag)) return svg;
  const box = /\sviewBox="([-\d.]+)[\s,]+([-\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)"/.exec(tag);
  if (!box) return svg;
  return `${svg.slice(0, end)} width="${box[3]}" height="${box[4]}"${svg.slice(end)}`;
}

const cache = new Map();

view.onRender(async ({ source, theme }) => {
  if (!source.trim()) throw new Error("The diagram is empty.");
  const config = await settings();
  const key = JSON.stringify([config, config.backend === "kroki" ? false : theme.dark, source]);
  const cached = cache.get(key);
  if (cached) return { svg: cached };
  const svg = sized(config.backend === "kroki" ? await krokiRender(config, source) : await localRender(config, source, theme));
  cache.set(key, svg);
  if (cache.size > 100) cache.delete(cache.keys().next().value);
  return { svg };
});
