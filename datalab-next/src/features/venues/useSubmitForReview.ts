import { useMutation, useQueryClient } from '@tanstack/react-query'
import { submitVenueForReview } from './api'
import type { Venue } from '../../types/venue'

/**
 * Review — the first editorial state transition. Same cache-update pattern
 * as useUpdateVenue: seed both caches from the server's response (now
 * `status: 'review'`) rather than mutating the client's copy locally.
 */
export function useSubmitForReview() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => submitVenueForReview(id),
    onSuccess: (updatedVenue) => {
      queryClient.setQueryData(['venue', updatedVenue.id], updatedVenue)
      queryClient.setQueryData<Venue[]>(['venues'], (venues) =>
        venues?.map((venue) => (venue.id === updatedVenue.id ? updatedVenue : venue)),
      )
    },
  })
}
