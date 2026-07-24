import { apiGet } from '../../lib/apiClient'
import type { PublishRevisionDetail, PublishRevisionSummary } from './types'

export function fetchPublishRevisions(): Promise<PublishRevisionSummary[]> {
  return apiGet<PublishRevisionSummary[]>('/publish/revisions')
}

export function fetchPublishRevision(id: number): Promise<PublishRevisionDetail> {
  return apiGet<PublishRevisionDetail>(`/publish/revisions/${id}`)
}
