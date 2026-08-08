import { useQuery } from '@tanstack/react-query'
import { fetchSystemHealth } from './api'

/** System Health Dashboard — read-only, on-demand snapshot of live
 * server/Docker/database/API metrics. No polling (`refetchInterval` stays
 * unset) — the dashboard's Refresh button drives `refetch()` explicitly
 * instead, per this phase's "No polling" rule. */
export function useSystemHealth() {
  return useQuery({
    queryKey: ['ops', 'system-health'],
    queryFn: fetchSystemHealth,
    retry: false,
    refetchOnWindowFocus: false,
  })
}
