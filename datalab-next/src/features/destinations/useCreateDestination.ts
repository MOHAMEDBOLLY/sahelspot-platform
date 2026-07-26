import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createDestination, type DestinationCreateInput } from './api'

/** Sprint 29 — same cache-invalidation shape as `useUpdateDestination`:
 * a new destination affects the list, so refetch it rather than trying to
 * patch a specific paged/filtered view that may not even include it. */
export function useCreateDestination() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: DestinationCreateInput) => createDestination(input),
    onSuccess: (destination) => {
      queryClient.setQueryData(['destination', destination.id], destination)
      queryClient.invalidateQueries({ queryKey: ['destinations'] })
    },
  })
}
