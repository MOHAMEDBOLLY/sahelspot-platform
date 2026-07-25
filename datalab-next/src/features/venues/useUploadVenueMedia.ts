import { useMutation, useQueryClient } from '@tanstack/react-query'
import { uploadVenueMedia, type MediaSlot } from './api'

/**
 * Sprint 25's upload mutation — same cache-seeding shape as
 * `useUpdateVenue`, since the server's response here is exactly the same
 * kind of fact: the authoritative, already-persisted venue. Sprint 27: the
 * list cache is invalidated instead of patched directly — see
 * `useUpdateVenue`'s docstring for why.
 */
export function useUploadVenueMedia() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      file,
      slot,
      onProgress,
    }: {
      id: string
      file: File
      slot: MediaSlot
      onProgress?: (percent: number) => void
    }) => uploadVenueMedia(id, file, slot, onProgress),
    onSuccess: (updatedVenue) => {
      queryClient.setQueryData(['venue', updatedVenue.id], updatedVenue)
      queryClient.invalidateQueries({ queryKey: ['venues'] })
    },
  })
}
