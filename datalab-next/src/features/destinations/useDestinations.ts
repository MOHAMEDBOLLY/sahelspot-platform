import { useQuery } from '@tanstack/react-query'
import { fetchDestinations } from './api'
import type { DestinationSearchParams } from '../../types/destination'

/** Sprint 29 — `params` is part of the query key, same reasoning venues'
 * `useVenues` already documents (Sprint 27): each distinct search/page
 * combination gets its own cache entry. `pageSize` defaults to 50 here,
 * same as venues — this sprint doesn't build page-navigation controls,
 * just search, so one generously-sized page is requested. */
export function useDestinations(params: DestinationSearchParams = {}) {
  return useQuery({
    queryKey: ['destinations', params],
    queryFn: () => fetchDestinations(params),
    retry: 1,
  })
}
