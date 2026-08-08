import { useQuery } from "@tanstack/react-query";
import { searchVenues, type VenueSearchParams } from "@/lib/api/venues";
import { toVenue } from "@/lib/domain/mappers/venue";

/** Distinct query key per (q, category) pair — Search's four states (default,
 * results, empty, loading) fall directly out of TanStack's own status plus
 * `enabled`, rather than needing separate state of their own. `enabled: false`
 * when both params are empty is what keeps the "default" state (recent
 * searches + categories, no query yet) from firing a request at all. */
export function useSearchVenues(params: VenueSearchParams) {
  const hasQuery = Boolean(
    params.q?.trim() ||
      params.category ||
      params.destination ||
      params.accessType ||
      (params.tags && params.tags.length > 0),
  );

  return useQuery({
    queryKey: [
      "venues",
      "search",
      params.q ?? "",
      params.category ?? "",
      params.destination ?? "",
      (params.tags ?? []).join(","),
      params.accessType ?? "",
    ],
    queryFn: async () => {
      const dtos = await searchVenues(params);
      return dtos.map(toVenue);
    },
    enabled: hasQuery,
  });
}
