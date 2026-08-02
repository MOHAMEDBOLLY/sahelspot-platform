import { useMutation, useQueryClient } from '@tanstack/react-query'
import { approveDestination } from './api'

/** Approval — the second editorial state transition (`review -> approved`),
 * same shape as venues' `useApproveVenue`. */
export function useApproveDestination() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => approveDestination(id),
    onSuccess: (updatedDestination) => {
      queryClient.setQueryData(['destination', updatedDestination.id], updatedDestination)
      queryClient.invalidateQueries({ queryKey: ['destinations'] })
    },
  })
}
