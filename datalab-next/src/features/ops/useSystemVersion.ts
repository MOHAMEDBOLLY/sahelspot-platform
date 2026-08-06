import { useQuery } from '@tanstack/react-query'
import { fetchSystemVersion } from './api'

/** Backend name/version for the System Information card — read-only,
 * nothing to invalidate a cache for. */
export function useSystemVersion() {
  return useQuery({
    queryKey: ['ops', 'system-version'],
    queryFn: fetchSystemVersion,
  })
}
