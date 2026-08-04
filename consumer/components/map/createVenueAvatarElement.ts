import { CATEGORY_BY_VALUE } from "@/lib/domain/categories";
import type { Venue } from "@/lib/domain/venue";

/** Small circular avatar for the marker preview chip — venue image if one
 * exists, otherwise a colored circle with the venue's first letter. Plain
 * DOM, matching `createMarkerElement.ts`: markers (and the chip they morph
 * into) are Mapbox GL DOM elements, not React, so this stays in the same
 * vanilla-DOM factory style rather than mounting a React tree into a marker. */
export function createVenueAvatarElement(venue: Pick<Venue, "name" | "category" | "coverImageUrl">): HTMLDivElement {
  const size = 28;
  const el = document.createElement("div");
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.borderRadius = "9999px";
  el.style.flexShrink = "0";
  el.style.overflow = "hidden";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";

  if (venue.coverImageUrl) {
    const img = document.createElement("img");
    img.src = venue.coverImageUrl;
    img.alt = "";
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "cover";
    el.appendChild(img);
    return el;
  }

  el.style.background = CATEGORY_BY_VALUE[venue.category].color;
  const initial = document.createElement("span");
  initial.textContent = (venue.name.trim()[0] ?? "?").toUpperCase();
  initial.style.color = "white";
  initial.style.fontSize = "13px";
  initial.style.fontWeight = "700";
  initial.setAttribute("aria-hidden", "true");
  el.appendChild(initial);
  return el;
}
