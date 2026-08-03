import { useMutation, useQueryClient } from '@tanstack/react-query'
import { moveVenueToDraft } from './api'

/** `approved -> draft`. Same cache-seeding shape as `useApproveVenue`. */
export function useMoveVenueToDraft() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => moveVenueToDraft(id),
    onSuccess: (updatedVenue) => {
      queryClient.setQueryData(['venue', updatedVenue.id], updatedVenue)
      queryClient.invalidateQueries({ queryKey: ['venues'] })
    },
  })
}
