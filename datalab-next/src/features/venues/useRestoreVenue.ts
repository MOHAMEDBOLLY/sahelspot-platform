import { useMutation, useQueryClient } from '@tanstack/react-query'
import { restoreVenue } from './api'

/** `archived -> approved`. Same cache-seeding shape as `useApproveVenue`. */
export function useRestoreVenue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => restoreVenue(id),
    onSuccess: (updatedVenue) => {
      queryClient.setQueryData(['venue', updatedVenue.id], updatedVenue)
      queryClient.invalidateQueries({ queryKey: ['venues'] })
    },
  })
}
