// A terminal in the detail panel: xterm.js drawing a shell that Typora runs
// in a pseudo-terminal (`process` permission). The shell belongs to the
// window, not to this page: when the page is shown again (another tab,
// another document) it attaches to the running shell and replays what it
// printed.

const view = typora.view;
const NAME = "terminal";

const LIGHT = {
  black: "#000000", red: "#cd3131", green: "#107c10", yellow: "#949800",
  blue: "#0451a5", magenta: "#bc05bc", cyan: "#0598bc", white: "#555555",
  brightBlack: "#666666", brightRed: "#cd3131", brightGreen: "#14ce14", brightYellow: "#b5ba00",
  brightBlue: "#0451a5", brightMagenta: "#bc05bc", brightCyan: "#0598bc", brightWhite: "#a5a5a5",
};
const DARK = {
  black: "#000000", red: "#cd3131", green: "#0dbc79", yellow: "#e5e510",
  blue: "#2472c8", magenta: "#bc3fbc", cyan: "#11a8cd", white: "#e5e5e5",
  brightBlack: "#666666", brightRed: "#f14c4c", brightGreen: "#23d18b", brightYellow: "#f5f543",
  brightBlue: "#3b8eea", brightMagenta: "#d670d6", brightCyan: "#29b8db", brightWhite: "#e5e5e5",
};

function themeFor(theme) {
  const vars = theme?.vars ?? {};
  const background = vars["--typora-background"] || (theme?.dark ? "#1e1e1e" : "#ffffff");
  const foreground = vars["--typora-foreground"] || (theme?.dark ? "#cccccc" : "#24292f");
  return {
    ...(theme?.dark ? DARK : LIGHT),
    background,
    foreground,
    cursor: foreground,
    cursorAccent: background,
    selectionBackground: theme?.dark ? "rgba(255, 255, 255, 0.25)" : "rgba(0, 0, 0, 0.18)",
  };
}

/** The setting, or else the size of the document's text. */
function fontSizeFor(settings, theme) {
  if (Number(settings.fontSize) > 0) return Number(settings.fontSize);
  return parseFloat(theme?.vars?.["--typora-editor-font-size"]) || 14;
}

function cssVar(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

const title = document.getElementById("title");
const holder = document.getElementById("terminal");
let term = null;
let fit = null;
/** The shell this page shows, or null while there is none. */
let proc = null;
let ended = false;
let disposers = [];

/** Fit the terminal to its box, unless the box is hidden or still animating in. */
function fitNow() {
  if (holder.clientWidth < 40 || holder.clientHeight < 20) return;
  const size = fit.proposeDimensions();
  if (!size || size.cols < 10 || size.rows < 2) return;
  fit.fit();
}

function show(text) {
  term?.write(`\r\n\x1b[2m${text}\x1b[0m\r\n`);
}

function detach() {
  for (const dispose of disposers.splice(0)) dispose();
}

function follow(next) {
  detach();
  proc = next;
  ended = false;
  title.textContent = next.command.split(/[\\/]/).pop() ?? "";
  disposers.push(next.onData((bytes) => term.write(bytes)));
  disposers.push(
    next.onExit(({ code, signal }) => {
      ended = true;
      show(`[${signal ? `Ended by ${signal}` : `Exited with ${code}`}. Press any key for a new session.]`);
    }),
  );
}

async function start() {
  const settings = await view.settings();
  const shell = typeof settings.shell === "string" && settings.shell.trim() ? settings.shell.trim() : view.process.shell;
  try {
    follow(await view.process.spawn(shell, [], { pty: { cols: term.cols, rows: term.rows }, name: NAME }));
  } catch (error) {
    ended = true;
    show(`${error.message} Press any key to try again.`);
  }
}

/** Show the window's shell if it still runs; otherwise start one. */
async function connect() {
  let running = null;
  try {
    running = (await view.process.list()).find((p) => p.name === NAME && p.running);
  } catch (error) {
    ended = true;
    show(`${error.message} Press any key to try again.`);
    return;
  }
  if (!running) {
    await start();
    return;
  }
  const attached = await view.process.attach(running.id);
  if (attached.output?.length) term.write(attached.output);
  follow(attached);
  // Full-screen programs redraw on a size change; nudge one.
  await attached.resize(term.cols, Math.max(1, term.rows - 1));
  await attached.resize(term.cols, term.rows);
}

async function main() {
  const settings = await view.settings();
  term = new Terminal({
    fontFamily: cssVar("--typora-mono-font", "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"),
    fontSize: fontSizeFor(settings, view.theme),
    scrollback: Number(settings.scrollback) > 0 ? Number(settings.scrollback) : 5000,
    cursorBlink: true,
    allowTransparency: false,
    theme: themeFor(view.theme),
  });
  fit = new FitAddon.FitAddon();
  term.loadAddon(fit);
  term.open(holder);
  fitNow();

  term.onData((data) => {
    if (ended) {
      term.reset();
      void start();
      return;
    }
    void proc?.write(data);
  });
  // Mouse reports in X10 mode are bytes, not text.
  term.onBinary((data) => void proc?.write(Uint8Array.from(data, (c) => c.charCodeAt(0) & 0xff)));
  term.onResize(({ cols, rows }) => {
    if (proc && !ended) void proc.resize(cols, rows);
  });
  new ResizeObserver(fitNow).observe(holder);
  view.onTheme((theme) => {
    term.options.theme = themeFor(theme);
    const size = fontSizeFor(settings, theme);
    if (size !== term.options.fontSize) {
      term.options.fontSize = size;
      fitNow();
    }
  });

  document.getElementById("clear").addEventListener("click", () => {
    term.clear();
    term.focus();
  });
  document.getElementById("restart").addEventListener("click", async () => {
    const old = proc;
    detach();
    proc = null;
    if (old?.running) await old.kill("SIGHUP").catch(() => {});
    term.reset();
    await start();
    term.focus();
  });

  await connect();
  term.focus();
}

void main();
