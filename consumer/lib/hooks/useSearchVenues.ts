import { useQuery } from "@tanstack/react-query";
import { searchVenues, type VenueSearchParams } from "@/lib/api/venues";
import { toVenue } from "@/lib/domain/mappers/venue";

/** Distinct query key per param combination — Search's four states (default,
 * results, empty, loading) fall directly out of TanStack's own status plus
 * `enabled`, rather than needing separate state of their own. `enabled: false`
 * when every param is empty is what keeps the "default" state (recent
 * searches + categories, no query yet) from firing a request at all.
 *
 * `options.enabled`, when given, overrides the params-derived default —
 * `SearchClient` uses this because `category` (a client-side-only filter,
 * see `searchVenues`'s own note on why) can be the *only* active filter,
 * which this hook's own params otherwise wouldn't see as a reason to
 * fetch. */
export function useSearchVenues(params: VenueSearchParams, options?: { enabled?: boolean }) {
  const hasParams = Boolean(
    params.q?.trim() ||
      params.destination ||
      params.accessType ||
      (params.tags && params.tags.length > 0),
  );
  const enabled = options?.enabled ?? hasParams;

  return useQuery({
    queryKey: [
      "venues",
      "search",
      params.q ?? "",
      params.destination ?? "",
      (params.tags ?? []).join(","),
      params.accessType ?? "",
    ],
    queryFn: async () => {
      const dtos = await searchVenues(params);
      return dtos.map(toVenue);
    },
    enabled,
  });
}
