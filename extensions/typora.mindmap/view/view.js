import { Markmap, resolveViewOptions, restoreTransform, installTrackpadNavigation } from "../vendor/markmap.js";
import { documentOutline, markmapTree } from "./model.js";

const view = window.typora.view;
const svg = document.getElementById("map");
const toolbar = document.querySelector(".toolbar");
const message = document.getElementById("message");
const localMenu = document.getElementById("options-menu");
let settings = { layout: "tree", theme: "classic", level: "all" };
let nativeToolbar = null, signature = "", tree = null, map = null, panelViewport = null;
let accessibilityTimer = 0;
let disposeNavigation = null;
const choices = [
  ["layout", "Layout", [["tree", "Tree"], ["two-sided", "Two-sided"], ["org-chart", "Org chart"]]],
  ["theme", "Style", [["classic", "Classic"], ["cards", "Cards"], ["minimal", "Minimal"]]],
  ["level", "Level", [["all", "All levels"], ...Array.from({ length: 6 }, (_, index) => [String(index + 1), `Level ${index + 1}`])]],
];
const ready = view.storage.get("mindmap.options").catch(() => null).then((saved) => {
  for (const [key, , values] of choices) if (values.some(([value]) => value === saved?.[key])) settings[key] = saved[key];
});
function options() {
  return resolveViewOptions({ wrapWidth: 170, colorScheme: view.theme?.dark ? "dark" : "light" }, {
    layout: settings.layout, theme: settings.theme,
    ...(settings.level === "all" ? {} : { foldLevel: Number(settings.level) - 1 }),
  }).options;
}
function eachNode(node, callback) {
  if (!node) return;
  callback(node); node.children.forEach((child) => eachNode(child, callback));
}
function decorate() {
  if (!map) return;
  const nodes = new Map(); eachNode(tree, (node) => nodes.set(node.id, node));
  for (const group of svg.querySelectorAll('[data-key^="node:"]')) {
    const node = nodes.get(group.dataset.nodeId);
    if (!node) continue;
    group.setAttribute("role", "button"); group.setAttribute("tabindex", "0");
    group.setAttribute("aria-label", node.data.label);
    if (node.children.length) group.setAttribute("aria-expanded", String(!map.foldedIds.has(node.id)));
    else group.removeAttribute("aria-expanded");
  }
}
function createMap(folded, transform) {
  disposeNavigation?.();
  map?.destroy(); map = new Markmap(svg, options());
  disposeNavigation = installTrackpadNavigation(map);
  map.on("render", () => {
    requestAnimationFrame(decorate); clearTimeout(accessibilityTimer);
    accessibilityTimer = setTimeout(decorate, map.options.duration + 30);
  });
  map.on("fold", () => requestAnimationFrame(decorate));
  if (tree) {
    map.setTree(tree);
    if (folded) map.setFoldedIds(folded, { animate: false });
    if (transform) restoreTransform(map, transform); else map.fit();
  }
}
function menuGroups() {
  return choices.map(([key, label, values]) => ({ label, items: values.map(([value, name]) => ({ id: `${key}:${value}`, label: name, checked: settings[key] === value })) }));
}
function buttons() {
  const icon = (id) => document.querySelector(`#${id} svg`).outerHTML;
  return [
    view.Button({ id: "zoom-out", tooltip: "Zoom out", icon: icon("zoom-out"), onClick: () => map?.zoomOut() }),
    view.Button({ id: "zoom-in", tooltip: "Zoom in", icon: icon("zoom-in"), onClick: () => map?.zoomIn() }),
    view.Button({ id: "options", tooltip: "Mind map options", icon: icon("options"), menu: menuGroups(), onClick: ({ itemId }) => choose(itemId) }),
    view.Button({ id: "fullsize", role: "fullsize", tooltip: "Full size",
      icon: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3h5v5M17 3l-6 6M8 17H3v-5M3 17l6-6"/></svg>',
      activeIcon: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 3l-6 6m0-5v5h5M3 17l6-6m-5 0h5v5"/></svg>',
    }),
  ];
}
function showToolbar(visible) {
  if (!nativeToolbar && view.capabilities?.toolbar) {
    nativeToolbar = view.Toolbar({ label: "Mind map controls", hidden: true, buttons: buttons() });
    void nativeToolbar.ready.catch((error) => view.log(error.message));
  }
  toolbar.hidden = !!nativeToolbar || !visible;
  if (nativeToolbar) void nativeToolbar.setHidden(!visible).catch((error) => view.log(error.message));
}
async function choose(itemId) {
  const [key, value] = String(itemId).split(":");
  const choice = choices.find(([name]) => name === key);
  if (!choice?.[2].some(([item]) => item === value)) return;
  settings[key] = value; localMenu.hidden = true;
  document.getElementById("options").setAttribute("aria-expanded", "false");
  map?.setOptions(options());
  if (key === "level") { if (value === "all") map?.expandAll(); else map?.foldToLevel(Number(value) - 1); }
  map?.fit();
  if (nativeToolbar) await nativeToolbar.update({ buttons: buttons() });
  await view.storage.set("mindmap.options", settings);
}
view.onDocument(async (document) => {
  await ready;
  const outline = documentOutline(document), next = JSON.stringify(outline);
  if (next === signature) return;
  tree = markmapTree(outline ?? []); svg.toggleAttribute("hidden", !tree);
  message.hidden = !!tree; message.textContent = "No headings in this document.";
  showToolbar(!!tree);
  if (tree) {
    if (!map) createMap();
    else { map.setTree(tree, options()); if (!signature || signature === "[]") map.fit(); }
  }
  signature = next;
});
// Labels and fold circles call Markmap's own animated toggle operation.
svg.addEventListener("click", (event) => {
  if (event.defaultPrevented) return;
  const group = event.target.closest('[data-key^="node:"]');
  if (!group || !map) return;
  let node; eachNode(tree, (item) => { if (item.id === group.dataset.nodeId) node = item; });
  if (!node) return;
  event.preventDefault(); event.stopPropagation();
  if (node.children.length) map.toggle(node.id);
  else if (node.data.blockId) void view.reveal({ blockId: node.data.blockId }).catch((error) => view.log(error.message));
}, true);
svg.addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === " ") && event.target.matches('[data-key^="node:"]')) {
    event.preventDefault(); event.target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }
});
document.getElementById("zoom-in").onclick = () => map?.zoomIn();
document.getElementById("zoom-out").onclick = () => map?.zoomOut();
document.getElementById("options").onclick = () => {
  localMenu.hidden = !localMenu.hidden;
  document.getElementById("options").setAttribute("aria-expanded", String(!localMenu.hidden));
  localMenu.replaceChildren(...menuGroups().map((group) => {
    const section = document.createElement("section"), label = document.createElement("div");
    label.textContent = group.label; section.append(label);
    for (const item of group.items) {
      const button = document.createElement("button"); button.type = "button"; button.textContent = item.label;
      button.setAttribute("role", "menuitemradio"); button.setAttribute("aria-checked", String(item.checked));
      button.onclick = () => void choose(item.id).catch((error) => view.log(error.message)); section.append(button);
    }
    return section;
  }));
};
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !localMenu.hidden) { event.preventDefault(); localMenu.hidden = true; }
});
view.onFullsize?.(async ({ fullsize }) => {
  if (!tree || !map) return;
  const folded = [...map.foldedIds];
  if (fullsize) panelViewport = map.transform;
  await new Promise(requestAnimationFrame);
  createMap(folded, fullsize ? null : panelViewport);
  if (!fullsize) panelViewport = null;
});
view.onTheme(() => map?.setOptions(options()));
window.addEventListener("pagehide", () => { clearTimeout(accessibilityTimer); disposeNavigation?.(); map?.destroy(); });
