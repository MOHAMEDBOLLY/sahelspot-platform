import { useQuery } from '@tanstack/react-query'
import { fetchLogsInfo } from './api'

/** Logs Dashboard — read-only, on-demand summary counts (never log
 * content). No polling; the card's Refresh button drives `refetch()`. */
export function useLogsInfo() {
  return useQuery({
    queryKey: ['ops', 'logs-info'],
    queryFn: fetchLogsInfo,
    retry: false,
    refetchOnWindowFocus: false,
  })
}
