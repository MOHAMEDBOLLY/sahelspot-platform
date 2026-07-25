import { useMutation, useQueryClient } from '@tanstack/react-query'
import { setCoverFromGallery } from './api'

/** Sprint 26 — same cache-seeding shape as `useUpdateVenue`/
 * `useUploadVenueMedia`: the server's response is the authoritative,
 * already-persisted venue. Sprint 27: the list cache is invalidated
 * instead of patched directly — see `useUpdateVenue`'s docstring for why. */
export function useSetCoverFromGallery() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, url }: { id: string; url: string }) => setCoverFromGallery(id, url),
    onSuccess: (updatedVenue) => {
      queryClient.setQueryData(['venue', updatedVenue.id], updatedVenue)
      queryClient.invalidateQueries({ queryKey: ['venues'] })
    },
  })
}
