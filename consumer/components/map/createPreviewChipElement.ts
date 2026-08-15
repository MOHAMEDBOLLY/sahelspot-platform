import { CATEGORY_BY_VALUE } from "@/lib/domain/categories";
import { VENUE_CATEGORY_LABEL } from "@/lib/domain/venueCategoryLabel";
import type { Venue } from "@/lib/domain/venue";

type CreatePreviewChipOptions = {
  onOpen: () => void;
};

const PIN_WIDTH = 130;
const PIN_HEIGHT = 168;
/** Upper two-thirds is the logo; the rest is the name/category footer. */
const LOGO_HEIGHT = Math.round((PIN_HEIGHT * 2) / 3);
const DOT_SIZE = 32;
const MORPH_DURATION_MS = 480;
const FRAME_THICKNESS = 4;

/** "Liquid Morph" — the marker doesn't get replaced by a card, it squashes
 * and stretches into one: briefly wide-and-flat (an anticipation beat
 * borrowed from character animation), then stretches tall while its
 * corners soften from a perfect circle into the branded marker's rounded
 * shape. One element, one continuous shape change — the small collapsed
 * marker this button is created to replace never separately exists; this
 * element starts *as* that dot and grows out of it.
 *
 * Mapbox positions a `bottom`-anchored marker via a CSS `translate(-50%,
 * -100%)` that's relative to the element's *current* size, recalculated
 * every frame — so animating `width`/`height` directly (rather than
 * `transform: scale()`, which would distort the content inside) keeps the
 * bottom edge locked to the coordinate for the entire animation with no
 * extra bookkeeping.
 *
 * Two real layers, not a border: `el` itself is the solid category-colored
 * shell (this venue's own map-marker color, animating through the same
 * shape the small dot did) and `card` is a separate white child, inset by
 * `FRAME_THICKNESS` via `position: absolute; inset`, which is what actually
 * holds the logo/name/category. `inset` recomputes every frame as `el`
 * resizes, so the white card grows in lockstep with the shell without
 * needing its own keyframes — but because it's a distinct element sitting
 * *inside* the colored one, it reads as a white card inside a colored
 * marker shell, not a colored line eating into the card's own edge (what a
 * `border` on a single element would look like). */
export function createPreviewChipElement(
  venue: Pick<Venue, "id" | "name" | "category" | "coverImageUrl" | "isOpenNow">,
  { onOpen }: CreatePreviewChipOptions,
): HTMLButtonElement {
  const dotColor = CATEGORY_BY_VALUE[venue.category].color;

  const el = document.createElement("button");
  el.type = "button";
  el.setAttribute("aria-label", `${venue.name} — open`);
  // No inline `position` — `mapbox-gl.css` needs `.mapboxgl-marker` to stay
  // `absolute`. An inline `relative` here put the chip into normal document
  // flow, which is what made it render far from its own anchor and clip off
  // the viewport edge (measured: a venue whose pin sat at x=91 produced a
  // chip painted at x=299..429 in a 390px viewport). `absolute` still
  // establishes the containing block the card/frame below position against.
  el.style.border = "none";
  el.style.cursor = "pointer";
  el.style.boxShadow = "0 14px 28px rgb(0 0 0 / 0.22)";
  el.style.overflow = "hidden";
  el.style.padding = "0";
  el.style.width = `${PIN_WIDTH}px`;
  el.style.height = `${PIN_HEIGHT}px`;
  el.style.borderRadius = "22px";
  el.style.background = dotColor;
  el.addEventListener("click", onOpen);

  el.animate(
    [
      { width: `${DOT_SIZE}px`, height: `${DOT_SIZE}px`, borderRadius: "50%", offset: 0 },
      {
        width: `${DOT_SIZE * 1.7}px`,
        height: `${DOT_SIZE * 0.75}px`,
        borderRadius: "40% 40% 45% 45%",
        offset: 0.35,
      },
      { width: `${PIN_WIDTH - 10}px`, height: `${PIN_HEIGHT - 14}px`, borderRadius: "26% 26% 20px 20px", offset: 0.7 },
      { width: `${PIN_WIDTH}px`, height: `${PIN_HEIGHT}px`, borderRadius: "22px", offset: 1 },
    ],
    { duration: MORPH_DURATION_MS, easing: "cubic-bezier(0.3, 0.9, 0.4, 1)", fill: "forwards" },
  );

  const card = document.createElement("div");
  card.style.position = "absolute";
  card.style.inset = `${FRAME_THICKNESS}px`;
  card.style.background = "white";
  card.style.borderRadius = "inherit";
  card.style.overflow = "hidden";
  card.style.display = "flex";
  card.style.flexDirection = "column";
  card.style.alignItems = "center";
  el.appendChild(card);

  const logo = document.createElement("div");
  logo.style.width = "100%";
  logo.style.height = `${LOGO_HEIGHT}px`;
  logo.style.flexShrink = "0";
  logo.style.display = "flex";
  logo.style.alignItems = "center";
  logo.style.justifyContent = "center";
  logo.style.overflow = "hidden";
  logo.style.background = "#F9F9FE";
  card.appendChild(logo);

  if (venue.coverImageUrl) {
    const img = document.createElement("img");
    img.src = venue.coverImageUrl;
    img.alt = "";
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "contain";
    img.style.padding = "10px";
    logo.appendChild(img);
  } else {
    logo.style.background = dotColor;
    const initial = document.createElement("span");
    initial.textContent = (venue.name.trim()[0] ?? "?").toUpperCase();
    initial.style.color = "white";
    initial.style.fontSize = "36px";
    initial.style.fontWeight = "800";
    initial.setAttribute("aria-hidden", "true");
    logo.appendChild(initial);
  }

  const footer = document.createElement("div");
  footer.style.width = "100%";
  footer.style.flex = "1";
  footer.style.display = "flex";
  footer.style.flexDirection = "column";
  footer.style.alignItems = "center";
  footer.style.justifyContent = "center";
  footer.style.gap = "2px";
  footer.style.padding = "4px 10px";
  card.appendChild(footer);

  const name = document.createElement("span");
  name.textContent = venue.name;
  name.style.display = "-webkit-box";
  name.style.webkitBoxOrient = "vertical";
  name.style.webkitLineClamp = "1";
  name.style.overflow = "hidden";
  name.style.textAlign = "center";
  name.style.fontSize = "13px";
  name.style.fontWeight = "700";
  name.style.lineHeight = "1.25";
  name.style.color = "#2E333A";
  footer.appendChild(name);

  const category = document.createElement("span");
  category.textContent = VENUE_CATEGORY_LABEL[venue.category];
  category.style.fontSize = "11px";
  category.style.fontWeight = "500";
  category.style.color = "#5B5F67";
  footer.appendChild(category);

  // Omitted entirely when unknown, matching `StatusBadge`'s own rule
  // elsewhere in the app — "no data" and "closed" are different facts.
  if (venue.isOpenNow !== null) {
    const status = document.createElement("span");
    status.textContent = venue.isOpenNow ? "OPEN" : "CLOSED";
    status.style.marginTop = "2px";
    status.style.padding = "1px 7px";
    status.style.borderRadius = "7px";
    status.style.fontSize = "9px";
    status.style.fontWeight = "700";
    status.style.letterSpacing = "0.02em";
    status.style.color = venue.isOpenNow ? "#2AA198" : "#5B5F67";
    status.style.background = venue.isOpenNow ? "rgb(42 161 152 / 0.1)" : "rgb(91 95 103 / 0.1)";
    footer.appendChild(status);
  }

  // The logo/name/category/status only make sense once the shape has grown
  // enough to hold them — each fades in on its own delay, staggered within
  // the shape's own morph rather than all appearing at once when it
  // finishes.
  const fields = [logo, name, category, footer.children[2] as HTMLElement | undefined].filter(
    (el): el is HTMLElement => Boolean(el),
  );
  fields.forEach((field, index) => {
    field.style.opacity = "0";
    field.style.transition = "opacity 220ms ease-out";
    field.style.transitionDelay = `${140 + index * 60}ms`;
  });
  requestAnimationFrame(() => {
    fields.forEach((field) => {
      field.style.opacity = "1";
    });
  });

  return el;
}
