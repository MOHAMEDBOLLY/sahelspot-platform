import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createVenue, type VenueCreateInput } from './api'

/** Same cache-invalidation shape as destinations' `useCreateDestination`:
 * a new venue affects the list, so refetch it rather than patching a
 * specific paged/filtered view that may not even include it. */
export function useCreateVenue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: VenueCreateInput) => createVenue(input),
    onSuccess: (venue) => {
      queryClient.setQueryData(['venue', venue.id], venue)
      queryClient.invalidateQueries({ queryKey: ['venues'] })
    },
  })
}
