import { useMutation, useQueryClient } from '@tanstack/react-query'
import { approveEvent } from './api'

export function useApproveEvent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => approveEvent(id),
    onSuccess: (event) => {
      queryClient.setQueryData(['event', event.id], event)
      queryClient.invalidateQueries({ queryKey: ['events'] })
    },
  })
}
