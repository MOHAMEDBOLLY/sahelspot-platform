import { CATEGORY_BY_VALUE } from "./categories";
import type { VenueCategory } from "./venue";

/** Human label for `category` — the one real field Venue Details' tag row can
 * derive a pill from ("Beach Club" in the export). `tags` itself
 * (API_REQUIREMENTS.md §8) has no source yet, so this is the only tag shown
 * until Studio delivers it. Derived from the canonical taxonomy in
 * `categories.ts` rather than its own table. */
export const VENUE_CATEGORY_LABEL: Record<VenueCategory, string> = Object.fromEntries(
  Object.entries(CATEGORY_BY_VALUE).map(([value, category]) => [value, category.label]),
) as Record<VenueCategory, string>;
