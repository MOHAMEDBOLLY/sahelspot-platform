import { useQuery } from '@tanstack/react-query'
import { fetchPublishRevisions } from './api'

/** Read-only revision history — the Revision Browser's list. No mutation
 * exists for this feature; there is nothing here to invalidate a cache for. */
export function useRevisions() {
  return useQuery({
    queryKey: ['publish-revisions'],
    queryFn: fetchPublishRevisions,
  })
}
