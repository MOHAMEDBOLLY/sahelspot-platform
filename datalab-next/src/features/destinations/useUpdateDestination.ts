import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateDestination, type DestinationPatch } from './api'

/** Save Draft's mutation. Sprint 29: the list cache is invalidated instead
 * of patched directly — same reasoning venues' `useUpdateVenue` docstring
 * gives (Sprint 27): the list is now keyed by search/page params, so
 * there's no single canonical array left to patch in place. */
export function useUpdateDestination() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, version, patch }: { id: string; version: number; patch: DestinationPatch }) =>
      updateDestination(id, version, patch),
    onSuccess: (updatedDestination) => {
      queryClient.setQueryData(['destination', updatedDestination.id], updatedDestination)
      queryClient.invalidateQueries({ queryKey: ['destinations'] })
    },
  })
}
