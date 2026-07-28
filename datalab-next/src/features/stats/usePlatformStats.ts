import { useQuery } from '@tanstack/react-query'
import { fetchPlatformStats } from './api'

export function usePlatformStats() {
  return useQuery({
    queryKey: ['platform-stats'],
    queryFn: fetchPlatformStats,
  })
}
