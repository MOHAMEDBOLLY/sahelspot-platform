import { useQuery } from "@tanstack/react-query";
import { fetchVenues } from "@/lib/api/venues";
import { toVenue } from "@/lib/domain/mappers/venue";

/** Every list-screen consumer of `/public/venues` shares this one query key
 * and cache entry — Home, Map, and Saved's content lookup all read the same
 * fetched-and-mapped list rather than issuing their own requests.
 *
 * `enabled` (default `true`, matching TanStack's own default when omitted)
 * — SearchClient passes `hasQuery` here: it only needs this list to compute
 * Popular Tags chips, which don't render at all in Search's default
 * "recent searches" state, so fetching the full catalog on every Search
 * visit before a user has even searched would be a wasted request. */
export function useVenues(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["venues"],
    queryFn: async () => {
      const dtos = await fetchVenues();
      return dtos.map(toVenue);
    },
    enabled: options?.enabled,
  });
}
