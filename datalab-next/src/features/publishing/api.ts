import { apiGet, apiPost } from '../../lib/apiClient'
import type { PublishRevisionDetail, PublishRevisionSummary } from './types'

export function fetchPublishRevisions(): Promise<PublishRevisionSummary[]> {
  return apiGet<PublishRevisionSummary[]>('/editor/publish/revisions')
}

export function fetchPublishRevision(id: number): Promise<PublishRevisionDetail> {
  return apiGet<PublishRevisionDetail>(`/editor/publish/revisions/${id}`)
}

/** Republish — makes an existing revision current again. Never creates a
 * new snapshot; rejects with a structured error (404 unknown, 409 already
 * current) rather than performing the pointer move unconditionally. */
export function republishRevision(id: number): Promise<PublishRevisionSummary> {
  return apiPost<PublishRevisionSummary>(`/editor/publish/revisions/${id}/republish`)
}
