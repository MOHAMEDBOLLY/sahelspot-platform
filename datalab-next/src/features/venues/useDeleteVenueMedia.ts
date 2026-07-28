import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteVenueCoverImage, deleteVenueGalleryImage } from './api'

/** EP20-T02 — actually deletes the stored file, not just the reference,
 * via `DELETE /editor/venues/{id}/media`. Same cache-seeding reasoning as
 * `useUpdateVenue`: trust the server's response over the local draft. */
export function useDeleteVenueCoverImage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteVenueCoverImage(id),
    onSuccess: (venue) => {
      queryClient.setQueryData(['venue', venue.id], venue)
      queryClient.invalidateQueries({ queryKey: ['venues'] })
    },
  })
}

export function useDeleteVenueGalleryImage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, url }: { id: string; url: string }) => deleteVenueGalleryImage(id, url),
    onSuccess: (venue) => {
      queryClient.setQueryData(['venue', venue.id], venue)
      queryClient.invalidateQueries({ queryKey: ['venues'] })
    },
  })
}
