import { useMutation, useQueryClient } from '@tanstack/react-query'
import { republishRevision } from './api'

/**
 * Republish — moves the current-revision pointer only; no snapshot is
 * created or changed. On success, invalidates both the revision list and
 * every cached revision-detail entry: republishing flips `is_current` on
 * two rows (the old current, and the target), so a targeted single-entry
 * cache update isn't enough — a full refetch is the simplest way to make
 * sure every previously-cached revision reflects its new `is_current` value.
 */
export function useRepublishRevision() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => republishRevision(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publish-revisions'] })
      queryClient.invalidateQueries({ queryKey: ['publish-revision'] })
    },
  })
}
