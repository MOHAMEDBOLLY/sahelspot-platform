import type { VenueCategory } from "./venue";

/** Human label for `category` — the one real field Venue Details' tag row can
 * derive a pill from ("Beach Club" in the export). `tags` itself
 * (API_REQUIREMENTS.md §8) has no source yet, so this is the only tag shown
 * until Studio delivers it. */
export const VENUE_CATEGORY_LABEL: Record<VenueCategory, string> = {
  beach: "Beach",
  food: "Restaurant",
  coffee: "Cafe",
  nightlife: "Nightlife",
  general: "Place",
};
