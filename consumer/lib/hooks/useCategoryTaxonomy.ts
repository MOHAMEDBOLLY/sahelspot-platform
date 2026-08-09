import { useMemo } from "react";
import { topTags, type TagFrequency } from "@/lib/domain/tags";
import type { Venue, VenueCategory } from "@/lib/domain/venue";

export type CategoryTaxonomy = {
  /** Venues in the selected category — `[]` when no category is selected,
   * since there's no scope to derive anything from. */
  venuesInCategory: Venue[];
  popularTags: TagFrequency[];
  hasReservationPolicy: boolean;
};

/** Category/Tags/Access Type/Badges/Collections architecture (Phase 3) —
 * the one place "which taxonomy applies to this category" is computed.
 * Search and Map both need identical scoping (tags and reservation policy
 * are only ever shown for venues actually inside the selected category,
 * never the full catalog — a Beach venue and a Restaurant don't share a
 * tag vocabulary in practice), so this is centralized here instead of
 * each screen re-deriving its own copy. Access Type is deliberately not
 * part of this: it's a closed, category-independent vocabulary
 * (`lib/domain/accessType.ts`), not something that needs scoping. */
export function useCategoryTaxonomy(
  venues: Venue[],
  category: VenueCategory | "all",
  tagLimit: number,
): CategoryTaxonomy {
  const venuesInCategory = useMemo(
    () => (category === "all" ? [] : venues.filter((venue) => venue.category === category)),
    [venues, category],
  );
  const popularTags = useMemo(
    () => topTags(venuesInCategory, tagLimit),
    [venuesInCategory, tagLimit],
  );
  const hasReservationPolicy = useMemo(
    () => venuesInCategory.some((venue) => venue.reservationPolicy !== null),
    [venuesInCategory],
  );

  return { venuesInCategory, popularTags, hasReservationPolicy };
}
