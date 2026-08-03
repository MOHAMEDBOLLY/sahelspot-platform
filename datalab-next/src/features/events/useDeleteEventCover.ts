import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteEventCover } from './api'

export function useDeleteEventCover() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteEventCover(id),
    onSuccess: (event) => {
      queryClient.setQueryData(['event', event.id], event)
      queryClient.invalidateQueries({ queryKey: ['events'] })
    },
  })
}
