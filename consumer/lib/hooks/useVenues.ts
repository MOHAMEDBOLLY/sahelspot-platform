import { useQuery } from "@tanstack/react-query";
import { fetchVenues } from "@/lib/api/venues";
import { toVenue } from "@/lib/domain/mappers/venue";

/** Every list-screen consumer of `/public/venues` shares this one query key
 * and cache entry — Home, Map, and Saved's content lookup all read the same
 * fetched-and-mapped list rather than issuing their own requests. */
export function useVenues() {
  return useQuery({
    queryKey: ["venues"],
    queryFn: async () => {
      const dtos = await fetchVenues();
      return dtos.map(toVenue);
    },
  });
}
