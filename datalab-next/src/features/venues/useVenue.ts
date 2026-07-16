import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchVenue } from './api'
import type { Venue } from '../../types/venue'

/**
 * GET /venues already returns full venue objects (same shape as
 * GET /venues/{id}), so a venue selected from an already-loaded list is
 * seeded from that cache as initialData — selecting it renders instantly
 * instead of re-fetching data we already have. TanStack Query still treats
 * this as real query state (it'll refetch in the background per normal
 * staleness rules), it just skips the redundant network round trip.
 */
export function useVenue(venueId: string | null) {
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: ['venue', venueId],
    queryFn: () => fetchVenue(venueId as string),
    enabled: venueId !== null,
    initialData: () => {
      if (!venueId) return undefined
      return queryClient
        .getQueryData<Venue[]>(['venues'])
        ?.find((venue) => venue.id === venueId)
    },
  })
}
