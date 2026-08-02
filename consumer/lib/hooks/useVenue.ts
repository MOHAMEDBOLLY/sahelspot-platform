import { useQuery } from "@tanstack/react-query";
import { fetchVenue } from "@/lib/api/venues";
import { toVenue } from "@/lib/domain/mappers/venue";

/** `data === null` (fetch succeeded, venue doesn't exist or isn't published)
 * and `isError` (the request itself failed) are kept distinct end to end —
 * the same distinction `fetchVenue` and `docs/adr/0001-public-venue-urls.md`
 * already make. The venue-details page renders `notFound()` for the first
 * and the error boundary for the second; conflating them would send a
 * genuine outage to the "this place doesn't exist" screen. */
export function useVenue(venueId: string) {
  return useQuery({
    queryKey: ["venue", venueId],
    queryFn: async () => {
      const dto = await fetchVenue(venueId);
      return dto ? toVenue(dto) : null;
    },
  });
}
