import { useMutation, useQueryClient } from '@tanstack/react-query'
import { rejectEvent } from './api'

export function useRejectEvent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectEvent(id, reason),
    onSuccess: (event) => {
      queryClient.setQueryData(['event', event.id], event)
      queryClient.invalidateQueries({ queryKey: ['events'] })
    },
  })
}
