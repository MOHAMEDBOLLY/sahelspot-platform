import { useQuery } from "@tanstack/react-query";
import { fetchHomeCollections } from "@/lib/api/collections";
import { toVenue } from "@/lib/domain/mappers/venue";
import type { Venue } from "@/lib/domain/venue";

export type HomeCollection = {
  slug: string;
  name: string;
  venues: Venue[];
};

/** Consumer Home Curation Integration V2 — ONE query for all three curated
 * Home sections (`best-beaches`/`food-picks`/`nightlife`), reading
 * `GET /public/collections` instead of three independent per-slug
 * requests. Reuses `toVenue` unchanged — a collection's `venues` are the
 * exact same `PublishedVenueOut` shape `/public/venues` returns, so there
 * is no second venue shape or venue store here, only a different
 * published list mapped through the one mapper every other venue list
 * already uses.
 *
 * Each collection's `venues` are in Studio's own editorial order (the
 * API's `Collection.sort_order`-ordered response, never re-sorted here).
 * The array's own order is not the Home section order — Home Section
 * Order Correction fixed each of the three sections (Best Beaches/Food
 * Picks/Nightlife) to its own position in the page layout, so
 * `HomeClient` looks up a section by slug rather than iterating this
 * array in sequence. Studio controls a section's content and its
 * venues' order; it does not control where the section sits on Home. */
export function useHomeCollections() {
  return useQuery<HomeCollection[]>({
    queryKey: ["home-collections"],
    queryFn: async () => {
      const dtos = await fetchHomeCollections();
      return dtos.map((dto) => ({
        slug: dto.slug,
        name: dto.name,
        venues: dto.venues.map(toVenue),
      }));
    },
  });
}
