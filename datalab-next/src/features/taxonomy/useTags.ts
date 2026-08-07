import { useQuery } from '@tanstack/react-query'
import { fetchTags } from './api'

export function useTags(category: string) {
  return useQuery({
    queryKey: ['tags', category],
    queryFn: () => fetchTags(category),
  })
}
