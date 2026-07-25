import { useQuery } from '@tanstack/react-query'
import { fetchVenue } from './api'

/**
 * Fetches a single venue. Before Sprint 27, this seeded `initialData` from
 * an already-loaded, unfiltered `['venues']` list cache — a venue selected
 * from the list rendered instantly with no extra round trip. Sprint 27
 * makes that seed source ambiguous: the list is now cached per
 * search/filter/page combination (`['venues', params]`), so there's no
 * longer one single cached array to look the venue up in. Removed rather
 * than kept as a more complex "find whichever filtered page happens to
 * have it" lookup — this is a minor loss of a redundant-fetch
 * optimization, not a correctness issue; the workspace still loads
 * correctly, just with one guaranteed request instead of an opportunistic
 * cache hit.
 */
export function useVenue(venueId: string | null) {
  return useQuery({
    queryKey: ['venue', venueId],
    queryFn: () => fetchVenue(venueId as string),
    enabled: venueId !== null,
  })
}
