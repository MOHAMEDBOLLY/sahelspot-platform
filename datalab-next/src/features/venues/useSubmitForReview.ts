import { useMutation, useQueryClient } from '@tanstack/react-query'
import { submitVenueForReview } from './api'

/**
 * Review — the first editorial state transition. Seeds the single-venue
 * cache from the server's response (now `status: 'review'`). Sprint 27:
 * the list cache is invalidated instead of patched directly — see
 * `useUpdateVenue`'s docstring for why, now that it's keyed by
 * search/filter params.
 */
export function useSubmitForReview() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => submitVenueForReview(id),
    onSuccess: (updatedVenue) => {
      queryClient.setQueryData(['venue', updatedVenue.id], updatedVenue)
      queryClient.invalidateQueries({ queryKey: ['venues'] })
    },
  })
}
