import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { fetchVenue } from "@/lib/api/venues";
import { toVenue } from "@/lib/domain/mappers/venue";
import type { Venue } from "@/lib/domain/venue";

/** The single source of truth for the venue query's key and fetcher — used
 * by `useVenue` below and by `VenueCard`'s hover/touch prefetch
 * (`queryClient.prefetchQuery(venueQueryOptions(id))`). Keeping this in one
 * place is what guarantees the prefetch actually warms the same cache entry
 * `useVenue` reads on the details page, rather than two subtly different
 * query keys that miss each other. */
export function venueQueryOptions(venueId: string): UseQueryOptions<Venue | null> {
  return {
    queryKey: ["venue", venueId],
    queryFn: async () => {
      const dto = await fetchVenue(venueId);
      return dto ? toVenue(dto) : null;
    },
  };
}

/** `data === null` (fetch succeeded, venue doesn't exist or isn't published)
 * and `isError` (the request itself failed) are kept distinct end to end —
 * the same distinction `fetchVenue` and `docs/adr/0001-public-venue-urls.md`
 * already make. The venue-details page renders `notFound()` for the first
 * and the error boundary for the second; conflating them would send a
 * genuine outage to the "this place doesn't exist" screen. */
export function useVenue(venueId: string) {
  return useQuery(venueQueryOptions(venueId));
}
