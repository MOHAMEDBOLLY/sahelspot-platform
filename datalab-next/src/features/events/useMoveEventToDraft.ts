import { useMutation, useQueryClient } from '@tanstack/react-query'
import { moveEventToDraft } from './api'

export function useMoveEventToDraft() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => moveEventToDraft(id),
    onSuccess: (event) => {
      queryClient.setQueryData(['event', event.id], event)
      queryClient.invalidateQueries({ queryKey: ['events'] })
    },
  })
}
