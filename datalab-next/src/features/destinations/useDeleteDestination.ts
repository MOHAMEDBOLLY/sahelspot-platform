import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteDestination } from './api'

/** Sprint 29. Removes the single-destination cache entry (there's nothing
 * left to seed it with) and invalidates the list so the deleted row
 * disappears from whatever view is currently on screen. */
export function useDeleteDestination() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteDestination(id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: ['destination', id] })
      queryClient.invalidateQueries({ queryKey: ['destinations'] })
    },
  })
}
