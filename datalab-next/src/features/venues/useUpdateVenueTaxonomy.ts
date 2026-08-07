import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateVenueTaxonomy, type VenueTaxonomyPatch } from './api'

/** Category/Tags/Access Type/Badges/Collections architecture (Phase 1) —
 * tag/collection assignment acts immediately (same "not part of the
 * Save Draft text-field cycle" reasoning `useDeleteVenueCoverImage`/
 * `useSetCoverFromGallery` already establish for media actions), rather
 * than requiring Edit Mode + Save. Same cache-seeding pattern as every
 * other venue mutation: trust the server's response over any local state. */
export function useUpdateVenueTaxonomy() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, version, patch }: { id: string; version: number; patch: VenueTaxonomyPatch }) =>
      updateVenueTaxonomy(id, version, patch),
    onSuccess: (venue) => {
      queryClient.setQueryData(['venue', venue.id], venue)
      queryClient.invalidateQueries({ queryKey: ['venues'] })
    },
  })
}
