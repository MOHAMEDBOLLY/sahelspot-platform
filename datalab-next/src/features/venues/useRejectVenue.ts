import { useMutation, useQueryClient } from '@tanstack/react-query'
import { rejectVenue } from './api'

/** EP21 — same cache-seeding shape as `useApproveVenue`. */
export function useRejectVenue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectVenue(id, reason),
    onSuccess: (updatedVenue) => {
      queryClient.setQueryData(['venue', updatedVenue.id], updatedVenue)
      queryClient.invalidateQueries({ queryKey: ['venues'] })
    },
  })
}
