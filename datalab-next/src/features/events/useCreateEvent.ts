import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createEvent, type EventCreateInput } from './api'

export function useCreateEvent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: EventCreateInput) => createEvent(input),
    onSuccess: (event) => {
      queryClient.setQueryData(['event', event.id], event)
      queryClient.invalidateQueries({ queryKey: ['events'] })
    },
  })
}
