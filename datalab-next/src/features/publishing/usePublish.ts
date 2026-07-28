import { useMutation, useQueryClient } from '@tanstack/react-query'
import { publishCurrentApprovedContent } from './api'

/** Publish — creates a new current revision from every approved
 * destination/venue. Invalidates the revision list (a new row appears)
 * and every cached revision-detail entry, same reasoning as
 * `useRepublishRevision`: publishing also flips `is_current` off the
 * previous revision. */
export function usePublish() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: publishCurrentApprovedContent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publish-revisions'] })
      queryClient.invalidateQueries({ queryKey: ['publish-revision'] })
    },
  })
}
