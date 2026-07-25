import { useMutation, useQueryClient } from '@tanstack/react-query'
import { uploadVenueMedia, type MediaSlot } from './api'
import type { Venue } from '../../types/venue'

/**
 * Sprint 25's upload mutation — same cache-seeding shape as
 * `useUpdateVenue`, since the server's response here is exactly the same
 * kind of fact: the authoritative, already-persisted venue.
 */
export function useUploadVenueMedia() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, file, slot }: { id: string; file: File; slot: MediaSlot }) =>
      uploadVenueMedia(id, file, slot),
    onSuccess: (updatedVenue) => {
      queryClient.setQueryData(['venue', updatedVenue.id], updatedVenue)
      queryClient.setQueryData<Venue[]>(['venues'], (venues) =>
        venues?.map((venue) => (venue.id === updatedVenue.id ? updatedVenue : venue)),
      )
    },
  })
}
