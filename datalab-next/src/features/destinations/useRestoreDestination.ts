import { useMutation, useQueryClient } from '@tanstack/react-query'
import { restoreDestination } from './api'

/** `archived -> approved`. Same cache-seeding shape as venues'
 * `useRestoreVenue`. */
export function useRestoreDestination() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => restoreDestination(id),
    onSuccess: (updatedDestination) => {
      queryClient.setQueryData(['destination', updatedDestination.id], updatedDestination)
      queryClient.invalidateQueries({ queryKey: ['destinations'] })
    },
  })
}
