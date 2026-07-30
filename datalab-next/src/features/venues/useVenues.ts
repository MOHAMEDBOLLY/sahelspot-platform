import { useQuery } from '@tanstack/react-query'
import { fetchVenues } from './api'
import type { VenueSearchParams } from '../../types/venue'

/** Sprint 27 — `params` is part of the query key, so each distinct
 * search/filter combination gets its own cache entry (switching back to a
 * previous search re-renders instantly from cache instead of refetching).
 * `pageSize` defaults to 50 here rather than in the caller — see
 * `fetchVenues`'s docstring for why this sprint doesn't build page
 * navigation.
 *
 * `options.enabled` — added for `useVenueSearch` (Phase 2 Quality Center),
 * which calls this hook unconditionally (Rules of Hooks) but only wants it
 * to actually fetch when the server-paginated path is the active one. */
export function useVenues(params: VenueSearchParams = {}, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['venues', params],
    queryFn: () => fetchVenues(params),
    // Fast, predictable failure feedback for an editorial tool beats a
    // silent multi-second retry sequence before the error state appears.
    retry: 1,
    enabled: options.enabled,
  })
}
