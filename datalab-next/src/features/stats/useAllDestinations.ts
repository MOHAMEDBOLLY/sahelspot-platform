import { useQuery } from '@tanstack/react-query'
import { fetchAllDestinations } from '../destinations/api'

/** Full, unpaginated destination set — used for dashboard aggregation
 * (per-destination venue completion grouping). */
export function useAllDestinations() {
  return useQuery({
    queryKey: ['destinations', 'all'],
    queryFn: fetchAllDestinations,
  })
}
