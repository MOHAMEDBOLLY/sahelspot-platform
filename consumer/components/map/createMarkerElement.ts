import { CATEGORY_MARKER_COLOR, CATEGORY_MARKER_ICON } from "@/lib/map/config";
import type { VenueCategory } from "@/lib/domain/venue";

/** Mapbox GL markers are plain DOM elements, not React components — this is
 * the one factory function every venue marker is built from. Circular,
 * white 2px border, category colour and icon, matching
 * `interactive_map_1/code.html` exactly: `w-8 h-8` for ordinary pins,
 * `w-10 h-10` + heavier shadow for the selected one. */
export function createMarkerElement(
  category: VenueCategory,
  options: { selected?: boolean; label: string } = { label: "" },
): HTMLButtonElement {
  const size = options.selected ? 40 : 32;
  const el = document.createElement("button");
  el.type = "button";
  el.setAttribute("aria-label", options.label);
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.borderRadius = "9999px";
  el.style.border = "2px solid white";
  el.style.background = CATEGORY_MARKER_COLOR[category];
  el.style.boxShadow = options.selected
    ? "0 4px 12px rgb(0 0 0 / 0.25)"
    : "0 2px 6px rgb(0 0 0 / 0.2)";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.cursor = "pointer";
  el.style.padding = "0";

  const icon = document.createElement("span");
  icon.className = "material-symbols-outlined";
  icon.style.color = "white";
  icon.style.fontSize = options.selected ? "20px" : "16px";
  icon.textContent = CATEGORY_MARKER_ICON[category];
  icon.setAttribute("aria-hidden", "true");
  el.appendChild(icon);

  return el;
}

/** The pulsing blue-navy dot for the visitor's own location, `w-4 h-4`. */
export function createUserLocationElement(): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "user-location-pulse";
  el.style.position = "relative";
  el.style.width = "16px";
  el.style.height = "16px";
  el.style.borderRadius = "9999px";
  el.style.background = "#0D3B66";
  el.style.border = "2px solid white";
  el.style.boxShadow = "0 2px 6px rgb(0 0 0 / 0.3)";
  el.setAttribute("aria-hidden", "true");
  return el;
}
