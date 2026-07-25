import { useMutation, useQueryClient } from '@tanstack/react-query'
import { approveVenue } from './api'

/**
 * Approval — the second editorial state transition. Seeds the single-venue
 * cache from the server's response (now `status: 'approved'`). Sprint 27:
 * the list cache is invalidated instead of patched directly — see
 * `useUpdateVenue`'s docstring for why, now that it's keyed by
 * search/filter params.
 */
export function useApproveVenue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => approveVenue(id),
    onSuccess: (updatedVenue) => {
      queryClient.setQueryData(['venue', updatedVenue.id], updatedVenue)
      queryClient.invalidateQueries({ queryKey: ['venues'] })
    },
  })
}
