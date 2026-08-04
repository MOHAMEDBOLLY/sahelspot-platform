import { useMutation, useQueryClient } from '@tanstack/react-query'
import { moveDestinationToDraft } from './api'

/** `approved -> draft`. Same cache-seeding shape as venues'
 * `useMoveVenueToDraft`. */
export function useMoveDestinationToDraft() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => moveDestinationToDraft(id),
    onSuccess: (updatedDestination) => {
      queryClient.setQueryData(['destination', updatedDestination.id], updatedDestination)
      queryClient.invalidateQueries({ queryKey: ['destinations'] })
    },
  })
}
