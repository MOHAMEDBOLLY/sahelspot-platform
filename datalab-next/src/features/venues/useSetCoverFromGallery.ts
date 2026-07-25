import { useMutation, useQueryClient } from '@tanstack/react-query'
import { setCoverFromGallery } from './api'
import type { Venue } from '../../types/venue'

/** Sprint 26 — same cache-seeding shape as `useUpdateVenue`/
 * `useUploadVenueMedia`: the server's response is the authoritative,
 * already-persisted venue. */
export function useSetCoverFromGallery() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, url }: { id: string; url: string }) => setCoverFromGallery(id, url),
    onSuccess: (updatedVenue) => {
      queryClient.setQueryData(['venue', updatedVenue.id], updatedVenue)
      queryClient.setQueryData<Venue[]>(['venues'], (venues) =>
        venues?.map((venue) => (venue.id === updatedVenue.id ? updatedVenue : venue)),
      )
    },
  })
}
