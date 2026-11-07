export { Markmap, resolveViewOptions } from "@markmap/view";
import { select } from "d3-selection";
import { zoom, zoomIdentity } from "d3-zoom";

// Restore a freshly created view through D3's public transform API, without
// replacing Markmap's event listeners or reaching into its private fields.
export function restoreTransform(map, transform) {
  select(map.element).call(zoom().transform, transform);
  map.backend.setTransform(transform);
}

/** Native desktop gestures: scroll pans; pinch zooms around its centroid. */
export function installTrackpadNavigation(map) {
  const element = map.element;
  const selection = select(element);
  const originalWheel = selection.on("wheel.zoom");
  // The pinned upstream view has no public pan API. Reuse its existing D3
  // behavior so source events also interrupt animations and update hit tests.
  const behavior = map.zoomBehavior;
  if (!behavior?.transform || !originalWheel) throw new Error("Unsupported Markmap gesture adapter version.");
  let gesture = null;
  const apply = (transform, event) => selection.call(behavior.transform, transform, null, event);
  const prevent = (event) => { event.preventDefault(); event.stopImmediatePropagation(); };
  selection.on("wheel.zoom", function (event) {
    if (event.defaultPrevented) return;
    if (event.ctrlKey) {
      if (gesture) prevent(event);
      else originalWheel.call(this, event);
      return;
    }
    if (!map.options.pan) return;
    prevent(event);
    const xUnit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientWidth : 1;
    const yUnit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1;
    const current = map.transform;
    apply(current.translate(-event.deltaX * xUnit / current.k, -event.deltaY * yUnit / current.k), event);
  }, { passive: false });
  const point = (event) => {
    const rect = element.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  };
  const start = (event) => {
    if (!map.options.zoom) return;
    prevent(event);
    gesture = { transform: map.transform, anchor: map.transform.invert(point(event)) };
    apply(map.transform, event);
  };
  const change = (event) => {
    if (!gesture || !Number.isFinite(event.scale) || event.scale <= 0) return;
    prevent(event);
    const [min, max] = map.scaleLimits;
    const scale = Math.max(min, Math.min(max, gesture.transform.k * event.scale));
    const [x, y] = point(event), [ax, ay] = gesture.anchor;
    apply(zoomIdentity.translate(x, y).scale(scale).translate(-ax, -ay), event);
  };
  const end = (event) => { if (gesture) prevent(event); gesture = null; };
  element.addEventListener("gesturestart", start, { passive: false });
  element.addEventListener("gesturechange", change, { passive: false });
  element.addEventListener("gestureend", end, { passive: false });
  return () => {
    selection.on("wheel.zoom", originalWheel, { passive: false });
    element.removeEventListener("gesturestart", start);
    element.removeEventListener("gesturechange", change);
    element.removeEventListener("gestureend", end);
  };
}
