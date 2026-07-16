import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateVenue, type VenuePatch } from './api'
import type { Venue } from '../../types/venue'

/**
 * Save Draft's mutation. On success, seeds both the single-venue cache and
 * the list cache with the server's response (the source of truth for what
 * actually got saved), rather than trusting the local draft — the API may
 * normalize values (e.g. numeric formatting) the client didn't.
 */
export function useUpdateVenue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: VenuePatch }) => updateVenue(id, patch),
    onSuccess: (updatedVenue) => {
      queryClient.setQueryData(['venue', updatedVenue.id], updatedVenue)
      queryClient.setQueryData<Venue[]>(['venues'], (venues) =>
        venues?.map((venue) => (venue.id === updatedVenue.id ? updatedVenue : venue)),
      )
    },
  })
}
