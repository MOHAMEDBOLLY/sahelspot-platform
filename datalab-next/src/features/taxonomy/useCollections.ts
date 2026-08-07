import { useQuery } from '@tanstack/react-query'
import { fetchCollections } from './api'

export function useCollections() {
  return useQuery({
    queryKey: ['collections'],
    queryFn: fetchCollections,
  })
}
