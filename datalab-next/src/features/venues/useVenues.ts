import { useQuery } from '@tanstack/react-query'
import { fetchVenues } from './api'

export function useVenues() {
  return useQuery({
    queryKey: ['venues'],
    queryFn: fetchVenues,
    // Fast, predictable failure feedback for an editorial tool beats a
    // silent multi-second retry sequence before the error state appears.
    retry: 1,
  })
}
