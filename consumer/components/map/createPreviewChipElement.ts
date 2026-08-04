import { createVenueAvatarElement } from "./createVenueAvatarElement";
import type { Venue } from "@/lib/domain/venue";

type CreatePreviewChipOptions = {
  saved: boolean;
  onOpen: () => void;
  onToggleSaved: () => void;
};

/** The active marker morphed into a compact floating chip — not a popup, not
 * a tooltip. Same element the pin was; its content and size change, nothing
 * is layered on top of it. Apple Maps-style: logo/initial avatar + name +
 * saved heart, nothing else. First click already happened (that's what
 * created this chip) — a second click here opens the venue's `BottomSheet`;
 * the heart intercepts its own click so toggling "saved" doesn't count as
 * that second click. */
export function createPreviewChipElement(
  venue: Pick<Venue, "id" | "name" | "category" | "coverImageUrl">,
  { saved, onOpen, onToggleSaved }: CreatePreviewChipOptions,
): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.setAttribute("aria-label", `${venue.name} — open`);
  el.style.display = "inline-flex";
  el.style.alignItems = "center";
  el.style.gap = "8px";
  el.style.maxWidth = "220px";
  el.style.padding = "6px 12px 6px 6px";
  el.style.borderRadius = "9999px";
  el.style.background = "white";
  el.style.boxShadow = "0 8px 20px rgb(0 0 0 / 0.18)";
  el.style.border = "none";
  el.style.cursor = "pointer";
  el.style.transform = "scale(0.9)";
  el.style.opacity = "0";
  el.style.transition = "transform 160ms ease, opacity 160ms ease";
  requestAnimationFrame(() => {
    el.style.transform = "scale(1)";
    el.style.opacity = "1";
  });
  el.addEventListener("click", onOpen);

  el.appendChild(createVenueAvatarElement(venue));

  const name = document.createElement("span");
  name.textContent = venue.name;
  name.style.fontSize = "13px";
  name.style.fontWeight = "600";
  name.style.color = "#2E333A";
  name.style.overflow = "hidden";
  name.style.textOverflow = "ellipsis";
  name.style.whiteSpace = "nowrap";
  el.appendChild(name);

  const heart = document.createElement("span");
  heart.className = "material-symbols-outlined";
  heart.textContent = "favorite";
  if (saved) heart.setAttribute("data-filled", "true");
  heart.style.fontSize = "18px";
  heart.style.flexShrink = "0";
  heart.style.color = saved ? "#F28705" : "#AEB2BB";
  heart.setAttribute("role", "button");
  heart.setAttribute("aria-label", saved ? "Remove from saved" : "Save");
  heart.addEventListener("click", (event) => {
    event.stopPropagation();
    onToggleSaved();
  });
  el.appendChild(heart);

  return el;
}
