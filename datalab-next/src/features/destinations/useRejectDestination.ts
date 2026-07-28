import { useMutation, useQueryClient } from '@tanstack/react-query'
import { rejectDestination } from './api'

/** EP21 — same cache-invalidation shape as `useUpdateDestination`. */
export function useRejectDestination() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectDestination(id, reason),
    onSuccess: (updatedDestination) => {
      queryClient.setQueryData(['destination', updatedDestination.id], updatedDestination)
      queryClient.invalidateQueries({ queryKey: ['destinations'] })
    },
  })
}
