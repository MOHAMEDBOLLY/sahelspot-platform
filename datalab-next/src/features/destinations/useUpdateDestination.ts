import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateDestination, type DestinationPatch } from './api'
import type { Destination } from '../../types/destination'

/** Save Draft's mutation — identical pattern to venues' `useUpdateVenue`:
 * seed both the single-destination and list caches from the server's
 * response on success. */
export function useUpdateDestination() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: DestinationPatch }) => updateDestination(id, patch),
    onSuccess: (updatedDestination) => {
      queryClient.setQueryData(['destination', updatedDestination.id], updatedDestination)
      queryClient.setQueryData<Destination[]>(['destinations'], (destinations) =>
        destinations?.map((destination) =>
          destination.id === updatedDestination.id ? updatedDestination : destination,
        ),
      )
    },
  })
}
