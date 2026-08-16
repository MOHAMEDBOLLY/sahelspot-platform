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
 * The returned array's order IS the Home section order — it comes
 * straight from the API's own `Collection.sort_order`-ordered response
 * and is never re-sorted here. `HomeClient` renders sections by iterating
 * this array directly, not by looking up three known slugs in a fixed
 * sequence. */
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
