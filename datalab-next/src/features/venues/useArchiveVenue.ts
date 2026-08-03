import { useMutation, useQueryClient } from '@tanstack/react-query'
import { archiveVenue } from './api'

/** `approved -> archived`. Same cache-seeding shape as `useApproveVenue`. */
export function useArchiveVenue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => archiveVenue(id),
    onSuccess: (updatedVenue) => {
      queryClient.setQueryData(['venue', updatedVenue.id], updatedVenue)
      queryClient.invalidateQueries({ queryKey: ['venues'] })
    },
  })
}
