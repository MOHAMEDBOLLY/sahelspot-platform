import type { VenueCategory } from "@/lib/domain/venue";

export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

/** Fallback camera position when no venue has real coordinates yet (an empty
 * publish snapshot, or every venue missing lat/lng) — the North Coast region
 * itself, matching Home's "North Coast" hero. A map default, not fabricated
 * content: it positions the camera, it doesn't claim a venue exists there. */
export const DEFAULT_CENTER: [number, number] = [28.7, 31.05];
export const DEFAULT_ZOOM = 10;

/** Category marker colours — docs/consumer/DESIGN_TOKENS.md, read directly
 * from `interactive_map_1/code.html`. Distinct from the brand palette: these
 * are data encodings, not brand colour reuse (nightlife/coffee have no brand
 * token at all). */
export const CATEGORY_MARKER_COLOR: Record<VenueCategory, string> = {
  general: "#0D3B66",
  beach: "#2AA198",
  food: "#F28705",
  nightlife: "#3730A3",
  coffee: "#7F4400",
};

export const CATEGORY_MARKER_ICON: Record<VenueCategory, string> = {
  general: "place",
  beach: "beach_access",
  food: "restaurant",
  nightlife: "nightlife",
  coffee: "coffee",
};

export const CATEGORY_FILTERS: readonly { value: VenueCategory | "all"; label: string; icon?: string }[] = [
  { value: "all", label: "All" },
  { value: "beach", label: "Beaches", icon: "beach_access" },
  { value: "food", label: "Food", icon: "restaurant" },
  { value: "coffee", label: "Coffee", icon: "coffee" },
  { value: "nightlife", label: "Nightlife", icon: "nightlife" },
];
