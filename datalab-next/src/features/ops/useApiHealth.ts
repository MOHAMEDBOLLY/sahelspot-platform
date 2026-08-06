import { useQuery } from '@tanstack/react-query'
import { fetchApiHealth } from './api'

/** API Health card — read-only status check, no polling/refresh control on
 * this dashboard (Sprint 1 scope is display-only; a real monitoring
 * integration is a later, separate sprint). A `503` surfaces as this
 * query's own `isError`, not a special-cased response value. */
export function useApiHealth() {
  return useQuery({
    queryKey: ['ops', 'api-health'],
    queryFn: fetchApiHealth,
    retry: false,
  })
}
