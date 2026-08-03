import { useMutation, useQueryClient } from '@tanstack/react-query'
import { restoreEvent } from './api'

export function useRestoreEvent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => restoreEvent(id),
    onSuccess: (event) => {
      queryClient.setQueryData(['event', event.id], event)
      queryClient.invalidateQueries({ queryKey: ['events'] })
    },
  })
}
