import { CATEGORY_BY_VALUE } from "@/lib/domain/categories";
import type { VenueCategory } from "@/lib/domain/venue";

/** Mapbox GL markers are plain DOM elements, not React components — this is
 * the one factory function every venue marker is built from. A classic
 * teardrop map pin (rounded head, pointed bottom) — navy fill, white 2px
 * border, the category's own icon in the head, matching the frozen Mobile
 * 2027 Design System's data-marker rule (docs/consumer/
 * MOBILE_2027_DESIGN_FREEZE.md §7 / Component Mapping §1 — markers are
 * navy-only, never category-color-coded). The active venue doesn't use an
 * enlarged variant of this — it morphs into `createPreviewChipElement`
 * instead (see `MapView`).
 *
 * Built with the standard CSS pin technique — a square with
 * `border-radius: 50% 50% 50% 0` rotated -45° turns one square corner
 * into the pin's downward point, no SVG/clip-path needed. The icon is
 * counter-rotated +45° so it renders upright inside the rotated head
 * (transforms compose down the DOM: without this, the icon would render
 * tilted along with its rotated parent). `MapView`'s marker now anchors
 * `"bottom"` (not `"center"`) for exactly this shape — a teardrop's
 * coordinate is its point, not its visual center. */
export function createMarkerElement(
  category: VenueCategory,
  options: { label: string; zIndex?: number },
): HTMLButtonElement {
  const headSize = 26;
  const el = document.createElement("button");
  el.type = "button";
  el.setAttribute("aria-label", options.label);
  // Deliberately does NOT set `position` — `mapbox-gl.css` styles
  // `.mapboxgl-marker` as `position: absolute`, and an inline `relative`
  // here beat that stylesheet rule, dropping every marker back into normal
  // document flow. Mapbox's `transform: translate(...)` was then applied on
  // top of a flow offset instead of from the container origin, so each
  // marker rendered displaced by its own index x its width: measured drift
  // ran 0, 26, 52, 78 ... 182px across the first eight pins, i.e. only the
  // very first marker ever landed on its real coordinate.
  //
  // `absolute` also establishes the containing block the head/icon below
  // rely on, so removing the inline value changes nothing about this
  // element's internal layout — it only stops fighting Mapbox's own
  // positioning.
  el.style.width = `${headSize}px`;
  el.style.height = `${headSize + 8}px`;
  el.style.background = "transparent";
  el.style.border = "none";
  el.style.padding = "0";
  el.style.cursor = "pointer";
  // Prioritize tagged/featured venues so a plain listing never visually
  // buries a more relevant one when markers sit close together — see
  // `MapView`'s `markerPriority` for how this is derived.
  if (options.zIndex !== undefined) el.style.zIndex = String(options.zIndex);

  const head = document.createElement("div");
  head.style.position = "absolute";
  head.style.top = "0";
  head.style.left = "0";
  head.style.width = `${headSize}px`;
  head.style.height = `${headSize}px`;
  head.style.borderRadius = "50% 50% 50% 0";
  head.style.border = "2px solid white";
  head.style.background = CATEGORY_BY_VALUE.general.color;
  head.style.boxShadow = "0 2px 5px rgb(0 0 0 / 0.25)";
  head.style.transform = "rotate(-45deg)";
  el.appendChild(head);

  const icon = document.createElement("span");
  icon.className = "material-symbols-outlined";
  icon.style.position = "absolute";
  icon.style.top = "50%";
  icon.style.left = "50%";
  icon.style.transform = "translate(-50%, -50%) rotate(45deg)";
  icon.style.color = "white";
  icon.style.fontSize = "13px";
  icon.textContent = CATEGORY_BY_VALUE[category].icon;
  icon.setAttribute("aria-hidden", "true");
  head.appendChild(icon);

  return el;
}

/** The pulsing blue-navy dot for the visitor's own location, `w-4 h-4`. */
export function createUserLocationElement(): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "user-location-pulse";
  // Same reason as the venue pin above — leave `position` to
  // `mapbox-gl.css`, which needs it to be `absolute`.
  el.style.width = "16px";
  el.style.height = "16px";
  el.style.borderRadius = "9999px";
  el.style.background = "#0D3B66";
  el.style.border = "2px solid white";
  el.style.boxShadow = "0 2px 6px rgb(0 0 0 / 0.3)";
  el.setAttribute("aria-hidden", "true");
  return el;
}
