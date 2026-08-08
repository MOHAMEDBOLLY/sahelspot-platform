import { useQuery } from '@tanstack/react-query'
import { fetchVersionInfo } from './api'

/** Consumer/Studio/Backend version info for the System Information card —
 * read-only, nothing to invalidate a cache for. */
export function useVersionInfo() {
  return useQuery({
    queryKey: ['ops', 'version-info'],
    queryFn: fetchVersionInfo,
  })
}
