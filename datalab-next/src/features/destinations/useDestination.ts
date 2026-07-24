import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchDestination } from './api'
import type { Destination } from '../../types/destination'

/** Same seeding pattern as venues' `useVenue` — GET /destinations already
 * returns full destination objects, so a destination selected from the
 * already-loaded list renders instantly instead of re-fetching. */
export function useDestination(destinationId: string | null) {
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: ['destination', destinationId],
    queryFn: () => fetchDestination(destinationId as string),
    enabled: destinationId !== null,
    initialData: () => {
      if (!destinationId) return undefined
      return queryClient
        .getQueryData<Destination[]>(['destinations'])
        ?.find((destination) => destination.id === destinationId)
    },
  })
}
