import { useQuery } from '@tanstack/react-query'
import { fetchPublishRevision } from './api'

export function useRevisionDetail(revisionId: number | null) {
  return useQuery({
    queryKey: ['publish-revision', revisionId],
    queryFn: () => fetchPublishRevision(revisionId as number),
    enabled: revisionId !== null,
  })
}
