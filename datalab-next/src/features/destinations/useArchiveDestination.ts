import { useMutation, useQueryClient } from '@tanstack/react-query'
import { archiveDestination } from './api'

/** `approved -> archived`. Same cache-seeding shape as venues'
 * `useArchiveVenue`. */
export function useArchiveDestination() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => archiveDestination(id),
    onSuccess: (updatedDestination) => {
      queryClient.setQueryData(['destination', updatedDestination.id], updatedDestination)
      queryClient.invalidateQueries({ queryKey: ['destinations'] })
    },
  })
}
