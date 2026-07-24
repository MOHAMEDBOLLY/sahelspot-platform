import { useMutation, useQueryClient } from '@tanstack/react-query'
import { approveVenue } from './api'
import type { Venue } from '../../types/venue'

/**
 * Approval — the second editorial state transition. Same cache-update
 * pattern as useSubmitForReview: seed both caches from the server's
 * response (now `status: 'approved'`) rather than mutating the client's
 * copy locally.
 */
export function useApproveVenue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => approveVenue(id),
    onSuccess: (updatedVenue) => {
      queryClient.setQueryData(['venue', updatedVenue.id], updatedVenue)
      queryClient.setQueryData<Venue[]>(['venues'], (venues) =>
        venues?.map((venue) => (venue.id === updatedVenue.id ? updatedVenue : venue)),
      )
    },
  })
}
