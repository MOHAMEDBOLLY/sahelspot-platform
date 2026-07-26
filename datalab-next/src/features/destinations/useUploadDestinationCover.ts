import { useMutation, useQueryClient } from '@tanstack/react-query'
import { uploadDestinationCover } from './api'

/** Sprint 29 — same cache-seeding shape as venues' `useUploadVenueMedia`:
 * the server's response is the authoritative, already-persisted
 * destination. */
export function useUploadDestinationCover() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      file,
      onProgress,
    }: {
      id: string
      file: File
      onProgress?: (percent: number) => void
    }) => uploadDestinationCover(id, file, onProgress),
    onSuccess: (updatedDestination) => {
      queryClient.setQueryData(['destination', updatedDestination.id], updatedDestination)
      queryClient.invalidateQueries({ queryKey: ['destinations'] })
    },
  })
}
