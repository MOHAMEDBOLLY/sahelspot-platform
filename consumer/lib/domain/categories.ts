/** Canonical venue-category taxonomy — the single source every category-aware
 * surface reads from (Map markers, Map/Search filter chips, category labels).
 *
 * Before this file, Consumer had two independent tables that had to be kept
 * in sync by hand: `CATEGORY_MAP` in `mappers/venue.ts` (raw Studio string ->
 * domain value) and `CATEGORY_MARKER_COLOR`/`CATEGORY_MARKER_ICON`/
 * `CATEGORY_FILTERS` in `lib/map/config.ts` (domain value -> presentation).
 * Both now derive from `CATEGORIES` below.
 *
 * Raw Studio category strings, confirmed against publish revision 1071 (401
 * venues): `Restaurant` (156), `Cafe` (50), `Activity` (39), `Shopping` (33),
 * `Spa` (28), `Hotel` (26), `Services` (20), `Resort` (20), `Beach Club` (19),
 * `Nightlife` (8), `Other` (2). None of Studio's category *names* are shown
 * to consumers directly — every raw value resolves to one of the friendly
 * domain categories below, or to `general` if it has no dedicated
 * presentation.
 *
 * `Activity`, `Resort`, and `Other` are internal Studio taxonomy — per
 * product decision, they must never appear in the Map or Search filter row
 * (`showInFilters: false` on the bucket they resolve to, or resolving to
 * `general`, which has no filter chip at all). `Activity` still needs a
 * home on the map, so it resolves to the closest real bucket
 * (`entertainment`) rather than disappearing into the visually-empty
 * `general` catch-all. */

export type VenueCategory =
  | "food"
  | "coffee"
  | "beach"
  | "hotel"
  | "nightlife"
  | "shopping"
  | "entertainment"
  | "spa"
  | "services"
  | "general";

export type CategoryDefinition = {
  value: VenueCategory;
  label: string;
  /** Material Symbols Outlined glyph — the one icon system used everywhere
   * in this app. Never emoji, never a second icon library. */
  icon: string;
  /** Marker/cluster color. A data encoding, not brand-palette reuse — see
   * docs/consumer/DESIGN_TOKENS.md's "Map marker categories" section. */
  color: string;
  /** Whether this category gets its own chip in the Map/Search filter row.
   * `general` is the only value never shown — it's the fallback for
   * categories with no dedicated presentation, not a real filter a user
   * would reach for. */
  showInFilters: boolean;
};

/** Ordered for filter-row display: "All" (added by consumers of this list)
 * followed by these, matching the approved category order. */
export const CATEGORIES: readonly CategoryDefinition[] = [
  { value: "food", label: "Food", icon: "restaurant", color: "#D64545", showInFilters: true },
  { value: "coffee", label: "Coffee", icon: "coffee", color: "#C87F0A", showInFilters: true },
  { value: "beach", label: "Beaches", icon: "beach_access", color: "#EAB308", showInFilters: true },
  { value: "hotel", label: "Hotels", icon: "hotel", color: "#2563EB", showInFilters: true },
  { value: "nightlife", label: "Nightlife", icon: "nightlife", color: "#3730A3", showInFilters: true },
  { value: "shopping", label: "Shopping", icon: "shopping_bag", color: "#16A34A", showInFilters: true },
  { value: "entertainment", label: "Entertainment", icon: "attractions", color: "#E64A6F", showInFilters: true },
  { value: "spa", label: "Spa", icon: "spa", color: "#2AA198", showInFilters: true },
  { value: "services", label: "Services", icon: "miscellaneous_services", color: "#6B7280", showInFilters: true },
  { value: "general", label: "Place", icon: "place", color: "#0D3B66", showInFilters: false },
];

export const CATEGORY_BY_VALUE: Record<VenueCategory, CategoryDefinition> = Object.fromEntries(
  CATEGORIES.map((category) => [category.value, category]),
) as Record<VenueCategory, CategoryDefinition>;

/** Raw Studio category string (lowercased) -> domain `VenueCategory`.
 * Unrecognized values fall back to `general` in `toVenueCategory` below
 * rather than throwing — a marker in the wrong-but-valid color is a much
 * smaller failure than a venue disappearing from the app entirely. */
const RAW_CATEGORY_MAP: Record<string, VenueCategory> = {
  restaurant: "food",
  cafe: "coffee",
  "beach club": "beach",
  beach: "beach",
  hotel: "hotel",
  resort: "hotel",
  nightlife: "nightlife",
  shopping: "shopping",
  activity: "entertainment",
  spa: "spa",
  services: "services",
  other: "general",
  // Accepted defensively in case Studio or seed data ever sends the
  // domain's own values directly.
  food: "food",
  coffee: "coffee",
  entertainment: "entertainment",
  general: "general",
};

export function toVenueCategory(raw: string): VenueCategory {
  return RAW_CATEGORY_MAP[raw.trim().toLowerCase()] ?? "general";
}

/** `{ value: "all" }` + every category with a filter chip — the Map's top
 * filter row and Search's category row, in the approved order. */
export const CATEGORY_FILTERS: readonly { value: VenueCategory | "all"; label: string; icon?: string }[] = [
  { value: "all", label: "All" },
  ...CATEGORIES.filter((category) => category.showInFilters).map((category) => ({
    value: category.value,
    label: category.label,
    icon: category.icon,
  })),
];
