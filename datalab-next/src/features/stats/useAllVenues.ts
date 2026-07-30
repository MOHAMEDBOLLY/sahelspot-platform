import { useQuery } from '@tanstack/react-query'
import { fetchAllVenues } from '../venues/api'

/** Full, unpaginated venue set — used for dashboard aggregation, where
 * every venue must be considered, not just one page. Also the data source
 * for `useVenueSearch`'s client-side quality-filter path (Phase 2 Quality
 * Center) — same hook, same cache entry, no second "fetch everything"
 * mechanism.
 *
 * `options.enabled` — lets a caller that must call this hook unconditionally
 * (Rules of Hooks) skip the actual fetch when it isn't the active path. */
export function useAllVenues(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['venues', 'all'],
    queryFn: fetchAllVenues,
    enabled: options.enabled,
  })
}
