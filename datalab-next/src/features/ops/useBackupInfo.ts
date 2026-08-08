import { useQuery } from '@tanstack/react-query'
import { fetchBackupInfo } from './api'

/** Backup Dashboard — read-only, on-demand snapshot of the newest backup
 * on disk. No polling; the card's Refresh button drives `refetch()`. */
export function useBackupInfo() {
  return useQuery({
    queryKey: ['ops', 'backup-info'],
    queryFn: fetchBackupInfo,
    retry: false,
    refetchOnWindowFocus: false,
  })
}
