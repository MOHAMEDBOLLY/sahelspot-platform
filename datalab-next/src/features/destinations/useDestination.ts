import { useQuery } from '@tanstack/react-query'
import { fetchDestination } from './api'

/**
 * Fetches a single destination. Before Sprint 29, this seeded
 * `initialData` from an already-loaded, unfiltered `['destinations']` list
 * cache. Sprint 29 makes that seed source ambiguous the same way Sprint 27
 * did for venues: the list is now cached per search/page combination
 * (`['destinations', params]`), so there's no longer one canonical array
 * to look the destination up in. Removed rather than kept as a more
 * complex "find whichever paged view happens to have it" lookup — a minor
 * loss of a redundant-fetch optimization, not a correctness issue.
 */
export function useDestination(destinationId: string | null) {
  return useQuery({
    queryKey: ['destination', destinationId],
    queryFn: () => fetchDestination(destinationId as string),
    enabled: destinationId !== null,
  })
}
