import { CATEGORY_BY_VALUE } from "@/lib/domain/categories";
import type { VenueCategory } from "@/lib/domain/venue";

/** Mapbox GL markers are plain DOM elements, not React components — this is
 * the one factory function every venue marker is built from. Circular,
 * white 2px border, navy fill with the category's own icon, matching the
 * frozen Mobile 2027 Design System's data-marker rule
 * (docs/consumer/MOBILE_2027_DESIGN_FREEZE.md §7 / Component Mapping §1 —
 * markers are navy-only, never category-color-coded). The active venue
 * doesn't use an enlarged variant of this — it morphs into
 * `createPreviewChipElement` instead (see `MapView`). */
export function createMarkerElement(category: VenueCategory, options: { label: string }): HTMLButtonElement {
  const size = 32;
  const el = document.createElement("button");
  el.type = "button";
  el.setAttribute("aria-label", options.label);
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.borderRadius = "9999px";
  el.style.border = "2px solid white";
  el.style.background = CATEGORY_BY_VALUE.general.color;
  el.style.boxShadow = "0 2px 6px rgb(0 0 0 / 0.2)";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.cursor = "pointer";
  el.style.padding = "0";

  const icon = document.createElement("span");
  icon.className = "material-symbols-outlined";
  icon.style.color = "white";
  icon.style.fontSize = "16px";
  icon.textContent = CATEGORY_BY_VALUE[category].icon;
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
