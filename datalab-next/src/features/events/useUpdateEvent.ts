import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateEvent, type EventPatch } from './api'

export function useUpdateEvent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, version, patch }: { id: string; version: number; patch: Partial<EventPatch> }) =>
      updateEvent(id, version, patch),
    onSuccess: (event) => {
      queryClient.setQueryData(['event', event.id], event)
      queryClient.invalidateQueries({ queryKey: ['events'] })
    },
  })
}
