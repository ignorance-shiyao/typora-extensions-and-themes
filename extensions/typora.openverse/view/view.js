// Openverse Images detail view (L1 page in the detail panel): search openly
// licensed images, favorites and shuffle. Clicking one inserts it at the
// caret, with a credit line.
//
// The page may not load remote images (img-src is the extension's own files),
// so thumbnails are fetched through view.fetch and shown from blob: URLs.
// Anonymous Openverse use is rate limited (about 200 searches a day), so
// nothing is requested until the user searches.
const view = window.typora.view;

const API = "https://api.openverse.org/v1/images/";
const PAGE = 20;
const CONCURRENT_LOADS = 6;
/** Load the next page this close to the end: near enough to scroll smoothly, late enough not to spend searches nobody looks at. */
const PREFETCH = 240;
const SUGGESTIONS = ["nature", "city", "coffee", "office", "mountains", "ocean", "flowers", "abstract", "texture", "space", "food", "books"];

const $ = (id) => document.getElementById(id);
const input = $("query");
const grid = $("grid");
const caption = $("caption");
const message = $("message");
const sentinel = $("sentinel");
const favoritesButton = $("favorites");
const startPanel = $("start");

let settings = {};
/** Saved images, newest first (the item shape below). */
let favorites = [];
let recent = [];

/** "start", "search" or "favorites". */
let mode = "start";
let query = "";
let page = 1;
let pageCount = Infinity;
let loading = false;
/** A page failed: wait for Try Again instead of asking again on every scroll. */
let stalled = false;
/** Bumped on every new listing so late answers to an old one are dropped. */
let generation = 0;
/** Page counts seen per query, so shuffle picks a page that exists. */
const pageCounts = new Map();

// ── Openverse ─────────────────────────────────────────────────────────

class RateLimited extends Error {}

async function api(params) {
  const url = new URL(API);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  if (settings.license && settings.license !== "any") url.searchParams.set("license_type", settings.license);
  if (settings.mature === true) url.searchParams.set("mature", "true");
  const response = await view.fetch(url.toString());
  if (response.status === 429) throw new RateLimited("Openverse's free daily limit for this network is used up. Try again tomorrow.");
  if (!response.ok) throw new Error(`Openverse answered ${response.status}. Try again in a moment.`);
  return response.json();
}

/** The parts of an Openverse result the page keeps (also what favorites store). */
function toItem(result) {
  return {
    id: String(result.id),
    title: String(result.title ?? "").trim(),
    url: String(result.url ?? ""),
    thumbnail: String(result.thumbnail ?? ""),
    landing: String(result.foreign_landing_url ?? ""),
    creator: String(result.creator ?? "").trim(),
    creatorUrl: String(result.creator_url ?? ""),
    license: String(result.license ?? "").toLowerCase(),
    licenseVersion: String(result.license_version ?? ""),
    licenseUrl: String(result.license_url ?? ""),
  };
}

/** "by-nc-sa" → "CC BY-NC-SA"; the public-domain tools by name. */
function licenseLabel(item, withVersion = false) {
  if (item.license === "cc0") return "CC0";
  if (item.license === "pdm") return "Public Domain";
  const name = `CC ${item.license.toUpperCase()}`;
  return withVersion && item.licenseVersion ? `${name} ${item.licenseVersion}` : name;
}

// ── Markdown ──────────────────────────────────────────────────────────

/** Text inside [ ] or * *: escape what Markdown would read as syntax. */
const escapeText = (text) => text.replace(/[\\[\]*_`<>]/g, "\\$&").replace(/\s+/g, " ");
/** A link destination: spaces and parentheses would end it early. */
const escapeUrl = (url) => url.replace(/[ ()]/g, (c) => ({ " ": "%20", "(": "%28", ")": "%29" })[c]);
const isWebUrl = (url) => /^https?:\/\//i.test(url);
const link = (text, url) => (isWebUrl(url) ? `[${text}](${escapeUrl(url)})` : text);

function creditLine(item) {
  const title = item.title ? link(`“${escapeText(item.title)}”`, item.landing) : link("Image", item.landing);
  const creator = item.creator ? ` by ${link(escapeText(item.creator), item.creatorUrl)}` : "";
  const license =
    item.license === "cc0"
      ? link("Public domain (CC0)", item.licenseUrl)
      : item.license === "pdm"
        ? link("Public domain", item.licenseUrl)
        : link(licenseLabel(item, true), item.licenseUrl);
  return `*Photo: ${title}${creator}, ${license}*`;
}

function markdownFor(item) {
  const alt = escapeText(item.title || "Image");
  const image = `![${alt}](${escapeUrl(item.url)})`;
  return settings.attribution === false ? image : `${image}\n\n${creditLine(item)}`;
}

// ── Listing ───────────────────────────────────────────────────────────

async function start(nextMode, nextQuery = query, firstPage = 1) {
  mode = nextMode;
  query = nextQuery;
  page = firstPage;
  pageCount = Infinity;
  loading = false;
  stalled = false;
  generation++;
  favoritesButton.setAttribute("aria-pressed", String(mode === "favorites"));
  input.placeholder = mode === "favorites" ? "Search favorites" : "Search images";
  clearGrid();
  saveState();
  startPanel.hidden = mode !== "start";
  if (mode === "favorites") return showFavorites();
  if (mode === "start") return showStart();
  settings = (await view.settings().catch(() => null)) ?? settings;
  caption.textContent = firstPage > 1 ? `Shuffled “${query}”` : `Results for “${query}”`;
  showSkeletons(12);
  await loadMore();
}

async function loadMore() {
  if (loading || stalled || mode !== "search" || page > pageCount) return;
  loading = true;
  const ticket = generation;
  try {
    const body = await api({ q: query, page, page_size: PAGE });
    if (ticket !== generation) return;
    const list = (body.results ?? []).map(toItem).filter((item) => item.thumbnail && isWebUrl(item.url));
    pageCount = Math.max(1, Number(body.page_count) || 1);
    pageCounts.set(query.toLowerCase(), pageCount);
    if (!(body.results ?? []).length) pageCount = page;
    page++;
    removeSkeletons();
    for (const item of list) grid.append(tileFor(item));
    if (list.length) remember(query);
    if (!grid.children.length) say(`No images for “${query}”.`);
  } catch (error) {
    if (ticket !== generation) return;
    removeSkeletons();
    stalled = true;
    say(error?.message || String(error), true, !(error instanceof RateLimited));
  } finally {
    if (ticket === generation) loading = false;
  }
  if (ticket === generation) {
    restoreScroll();
    if (nearBottom()) void loadMore();
  }
}

function showStart() {
  renderChips($("chips"), SUGGESTIONS);
  renderChips($("recent-chips"), recent.slice(0, 6));
  $("recent-block").hidden = !recent.length;
  caption.textContent = favorites.length ? "Favorites" : "";
  for (const item of favorites.slice(0, 8)) grid.append(tileFor(item));
}

function renderChips(container, terms) {
  container.replaceChildren(
    ...terms.map((term) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = term;
      chip.addEventListener("click", () => {
        input.value = term;
        void start("search", term);
      });
      return chip;
    }),
  );
}

function showFavorites() {
  const filter = query.trim().toLowerCase();
  const list = favorites.filter((item) => !filter || `${item.title} ${item.creator}`.toLowerCase().includes(filter));
  caption.textContent = filter ? `Favorites matching “${query}”` : "Favorites";
  for (const item of list) grid.append(tileFor(item));
  if (!favorites.length) say("No favorites yet. Point at an image and click its star to keep it here.");
  else if (!list.length) say(`No favorites match “${query}”.`);
  restoreScroll();
}

function shuffle() {
  if (mode === "favorites") {
    favorites.sort(() => Math.random() - 0.5);
    clearGrid();
    return showFavorites();
  }
  const term = input.value.trim() || SUGGESTIONS[Math.floor(Math.random() * SUGGESTIONS.length)];
  input.value = term;
  // A random page among those Openverse serves for it (12 for anonymous use).
  const pages = pageCounts.get(term.toLowerCase()) ?? 5;
  void start("search", term, 1 + Math.floor(Math.random() * pages));
}

// ── Tiles ─────────────────────────────────────────────────────────────

const loadQueue = [];
let activeLoads = 0;

const tileObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      tileObserver.unobserve(entry.target);
      loadQueue.push(entry.target);
    }
    pump();
  },
  { rootMargin: "300px 0px" },
);

function pump() {
  while (activeLoads < CONCURRENT_LOADS && loadQueue.length) {
    const tile = loadQueue.shift();
    if (!tile.isConnected) continue;
    activeLoads++;
    void loadTile(tile).finally(() => {
      activeLoads--;
      pump();
    });
  }
}

async function loadTile(tile) {
  const { item } = tile;
  tile.classList.add("loading");
  try {
    const response = await view.fetch(item.thumbnail);
    if (!response.ok) throw new Error(String(response.status));
    const type = response.headers?.["content-type"] || "image/jpeg";
    const blob = new Blob([await response.arrayBuffer()], { type });
    if (!tile.isConnected) return;
    const img = tile.querySelector("img");
    tile.objectUrl = URL.createObjectURL(blob);
    img.onload = () => {
      img.classList.add("loaded");
      tile.classList.remove("loading");
    };
    img.onerror = () => tile.classList.replace("loading", "failed");
    img.src = tile.objectUrl;
  } catch {
    tile.classList.replace("loading", "failed");
  }
}

const STAR = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.6l2.25 4.7 5.15.68-3.77 3.57.95 5.1L10 14.18l-4.58 2.47.95-5.1L2.6 7.98l5.15-.68z"/></svg>';

function tileFor(item) {
  const tile = document.createElement("div");
  tile.className = "tile";
  tile.item = item;
  tile.tabIndex = 0;
  tile.setAttribute("role", "button");
  const name = item.title || "Untitled";
  tile.setAttribute("aria-label", `Insert ${name}`);
  tile.title = `${name}${item.creator ? ` by ${item.creator}` : ""} · ${licenseLabel(item, true)}`;
  const img = document.createElement("img");
  img.alt = "";
  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = licenseLabel(item);
  const star = document.createElement("button");
  star.type = "button";
  star.className = "star";
  star.tabIndex = -1;
  star.innerHTML = STAR;
  markStar(star, item.id);
  star.addEventListener("click", (event) => {
    event.stopPropagation();
    void toggleFavorite(item, star);
  });
  tile.append(img, badge, star);
  tile.addEventListener("click", () => void insert(tile));
  tileObserver.observe(tile);
  return tile;
}

function markStar(star, id) {
  const on = favorites.some((f) => f.id === id);
  star.classList.toggle("on", on);
  star.setAttribute("aria-label", on ? "Remove from Favorites" : "Add to Favorites");
  star.title = on ? "Remove from Favorites" : "Add to Favorites";
}

function clearGrid() {
  for (const tile of grid.children) if (tile.objectUrl) URL.revokeObjectURL(tile.objectUrl);
  grid.replaceChildren();
  loadQueue.length = 0;
  message.hidden = true;
  caption.textContent = "";
}

function showSkeletons(count) {
  for (let i = 0; i < count; i++) {
    const tile = document.createElement("div");
    tile.className = "tile skeleton";
    tile.setAttribute("aria-hidden", "true");
    grid.append(tile);
  }
}

function removeSkeletons() {
  for (const tile of grid.querySelectorAll(".skeleton")) tile.remove();
}

function say(text, isError = false, canRetry = false) {
  $("message-text").textContent = text;
  message.classList.toggle("error", isError);
  $("retry").hidden = !canRetry;
  message.hidden = false;
}

$("retry").addEventListener("click", () => {
  const retryPage = Math.max(1, page);
  if (grid.querySelector(".tile")) {
    message.hidden = true;
    stalled = false;
    void loadMore();
  } else void start("search", query, retryPage);
});

// ── Actions ───────────────────────────────────────────────────────────

async function insert(tile) {
  const item = tile.item;
  if (typeof view.insertMarkdown !== "function") return toast("This needs a newer version of Typora.");
  try {
    settings = (await view.settings().catch(() => null)) ?? settings;
    const inserted = await view.insertMarkdown(markdownFor(item));
    if (inserted === false) return toast("Click in the document first, then pick an image.");
    tile.classList.remove("inserted");
    void tile.offsetWidth;
    tile.classList.add("inserted");
  } catch (error) {
    toast(error?.message || String(error));
  }
}

async function toggleFavorite(item, star) {
  const index = favorites.findIndex((f) => f.id === item.id);
  if (index >= 0) favorites.splice(index, 1);
  else favorites.unshift({ ...item });
  markStar(star, item.id);
  await view.storage.set("favorites", favorites);
  if ((mode === "favorites" || mode === "start") && index >= 0) {
    star.closest(".tile")?.remove();
    if (mode === "favorites" && !favorites.length) say("No favorites yet. Point at an image and click its star to keep it here.");
    if (mode === "start" && !favorites.length) caption.textContent = "";
  }
}

function remember(term) {
  recent = [term, ...recent.filter((t) => t.toLowerCase() !== term.toLowerCase())].slice(0, 10);
  renderRecent();
  void view.storage.set("recent", recent);
}

function renderRecent() {
  $("recent").replaceChildren(
    ...recent.map((term) => {
      const option = document.createElement("option");
      option.value = term;
      return option;
    }),
  );
}

let toastTimer = 0;
function toast(text) {
  const el = $("toast");
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 2600);
}

// ── Search field ──────────────────────────────────────────────────────

let searchTimer = 0;

function search() {
  clearTimeout(searchTimer);
  const term = input.value.trim();
  if (mode === "favorites") {
    query = term;
    clearGrid();
    saveState();
    return showFavorites();
  }
  if (term === query && (mode === "search" || (!term && mode === "start"))) return;
  void start(term ? "search" : "start", term);
}

// Searches cost quota: wait a little longer than for local filtering.
input.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(search, mode === "favorites" ? 150 : 600);
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    search();
  } else if (event.key === "Escape" && input.value) {
    event.preventDefault();
    input.value = "";
    search();
  } else if (event.key === "ArrowDown" && !event.altKey) {
    const first = grid.querySelector(".tile:not(.skeleton)");
    if (first) {
      event.preventDefault();
      first.focus();
    }
  }
});

// Favorites start unfiltered; leaving them brings the search back.
let searchBeforeFavorites = "";

favoritesButton.addEventListener("click", () => {
  if (mode === "favorites") {
    input.value = searchBeforeFavorites;
    void start(searchBeforeFavorites ? "search" : "start", searchBeforeFavorites);
  } else {
    searchBeforeFavorites = input.value.trim();
    input.value = "";
    void start("favorites", "");
  }
});

$("shuffle").addEventListener("click", shuffle);

// Arrow keys move between tiles; Enter / Space insert.
grid.addEventListener("keydown", (event) => {
  const tile = event.target.closest?.(".tile");
  if (!tile) return;
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    void insert(tile);
    return;
  }
  const tiles = [...grid.querySelectorAll(".tile:not(.skeleton)")];
  const columns = getComputedStyle(grid).gridTemplateColumns.split(" ").length || 1;
  const index = tiles.indexOf(tile);
  const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns }[event.key];
  if (step === undefined) return;
  event.preventDefault();
  const next = index + step;
  if (next < 0 && event.key === "ArrowUp") return input.focus();
  tiles[Math.max(0, Math.min(tiles.length - 1, next))]?.focus();
});

// ── Scrolling and state ───────────────────────────────────────────────

const scroller = document.scrollingElement || document.documentElement;

function nearBottom() {
  return mode === "search" && sentinel.getBoundingClientRect().top < window.innerHeight + PREFETCH;
}

new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && void loadMore(), {
  rootMargin: `${PREFETCH}px 0px`,
}).observe(sentinel);

let pendingScroll = 0;
let stateTimer = 0;

function saveState() {
  clearTimeout(stateTimer);
  stateTimer = setTimeout(() => {
    void view.setState?.({ mode, query, scroll: Math.round(scroller.scrollTop) });
  }, 150);
}

function restoreScroll() {
  if (!pendingScroll) return;
  if (scroller.scrollHeight - window.innerHeight < pendingScroll && page <= pageCount && mode === "search") return;
  scroller.scrollTop = pendingScroll;
  pendingScroll = 0;
}

window.addEventListener("scroll", saveState, { passive: true });

// ── Start ─────────────────────────────────────────────────────────────

async function init() {
  const [state, savedFavorites, savedRecent, savedSettings] = await Promise.all([
    view.getState?.().catch(() => null),
    view.storage.get("favorites"),
    view.storage.get("recent"),
    view.settings().catch(() => ({})),
  ]);
  favorites = Array.isArray(savedFavorites) ? savedFavorites : [];
  recent = Array.isArray(savedRecent) ? savedRecent : [];
  settings = savedSettings ?? {};
  renderRecent();
  const restored = state && typeof state === "object" ? state : {};
  query = typeof restored.query === "string" ? restored.query : "";
  input.value = query;
  pendingScroll = Number(restored.scroll) || 0;
  // Only a tab switch back to a search spends a request on open.
  const startMode = restored.mode === "favorites" ? "favorites" : query ? "search" : "start";
  await start(startMode, query);
}

void init();
