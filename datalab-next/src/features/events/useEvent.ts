import { useQuery } from '@tanstack/react-query'
import { fetchEvent } from './api'

export function useEvent(id: string | null) {
  return useQuery({
    queryKey: ['event', id],
    queryFn: () => fetchEvent(id as string),
    enabled: id !== null,
  })
}
