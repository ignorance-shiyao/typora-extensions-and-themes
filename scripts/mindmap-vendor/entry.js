export { Markmap, resolveViewOptions } from "@markmap/view";
import { select } from "d3-selection";
import { zoom } from "d3-zoom";

// Restore a freshly created view through D3's public transform API, without
// replacing Markmap's event listeners or reaching into its private fields.
export function restoreTransform(map, transform) {
  select(map.element).call(zoom().transform, transform);
  map.backend.setTransform(transform);
}
