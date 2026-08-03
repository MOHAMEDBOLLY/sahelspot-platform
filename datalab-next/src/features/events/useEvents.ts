import { useQuery } from '@tanstack/react-query'
import { fetchEvents } from './api'
import type { EventSearchParams } from '../../types/event'

export function useEvents(params: EventSearchParams = {}) {
  return useQuery({
    queryKey: ['events', params],
    queryFn: () => fetchEvents(params),
    retry: 1,
  })
}
