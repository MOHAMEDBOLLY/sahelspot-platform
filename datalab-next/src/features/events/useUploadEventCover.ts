import { useMutation, useQueryClient } from '@tanstack/react-query'
import { uploadEventCover } from './api'

export function useUploadEventCover() {
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
    }) => uploadEventCover(id, file, onProgress),
    onSuccess: (event) => {
      queryClient.setQueryData(['event', event.id], event)
      queryClient.invalidateQueries({ queryKey: ['events'] })
    },
  })
}
