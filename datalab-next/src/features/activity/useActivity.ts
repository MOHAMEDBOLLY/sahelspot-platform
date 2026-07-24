import { useQuery } from '@tanstack/react-query'
import { fetchActivity } from './api'

/** Read-only activity feed. No mutation exists for this feature — nothing
 * in the Studio ever writes an activity entry directly; every entry is
 * created server-side as a side effect of a workflow/publishing action. */
export function useActivity() {
  return useQuery({
    queryKey: ['activity'],
    queryFn: fetchActivity,
  })
}
