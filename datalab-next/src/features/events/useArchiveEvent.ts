import { useMutation, useQueryClient } from '@tanstack/react-query'
import { archiveEvent } from './api'

export function useArchiveEvent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => archiveEvent(id),
    onSuccess: (event) => {
      queryClient.setQueryData(['event', event.id], event)
      queryClient.invalidateQueries({ queryKey: ['events'] })
    },
  })
}
