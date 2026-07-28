import { apiGet, apiPost } from '../../lib/apiClient'
import type { PublishRevisionDetail, PublishRevisionSummary } from './types'

export function fetchPublishRevisions(): Promise<PublishRevisionSummary[]> {
  return apiGet<PublishRevisionSummary[]>('/editor/publish/revisions')
}

/** Publish — snapshots every currently approved destination/venue into a
 * new current revision. `excluded_venue_count` (PLATFORM_SPEC_v1.0_FROZEN.md
 * §1) is nonzero when an approved venue's destination isn't itself
 * approved — those venues are silently excluded from the snapshot rather
 * than failing the whole publish, so the caller is expected to surface
 * that count rather than treat a successful response as "everything made
 * it in." */
export function publishCurrentApprovedContent(): Promise<PublishRevisionSummary> {
  return apiPost<PublishRevisionSummary>('/editor/publish')
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
