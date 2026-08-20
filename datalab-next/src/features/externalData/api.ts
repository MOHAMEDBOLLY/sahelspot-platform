import { apiGet, apiPatch, apiPostJson, apiUpload } from '../../lib/apiClient'
import type { ExternalRecord, ExternalRecordListResponse } from '../../types/externalRecord'
import type { Venue } from '../../types/venue'

/** External Data Enrichment Workflow (Phase 1). Thin wrapper over
 * `/editor/external-records`, same "no client-side reshaping" pattern
 * every other feature's `api.ts` already establishes. */

export type ExternalRecordFilters = {
  source?: string
  category?: string
  destination?: string
  match_status?: string
  match_confidence?: string
  review_status?: string
  has_description?: boolean
  has_amenities?: boolean
  has_booking?: boolean
  missing_studio_data?: boolean
}

function toQuery(filters: ExternalRecordFilters): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export function fetchExternalRecords(filters: ExternalRecordFilters = {}): Promise<ExternalRecordListResponse> {
  return apiGet(`/editor/external-records${toQuery(filters)}`)
}

export function fetchExternalRecord(id: number): Promise<ExternalRecord> {
  return apiGet(`/editor/external-records/${id}`)
}

export function loadDetailFile(
  source: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<{ created: number; updated: number; source: string }> {
  const formData = new FormData()
  formData.append('source', source)
  formData.append('file', file)
  return apiUpload('/editor/external-records/load-detail', formData, onProgress)
}

export function loadMatchOverlay(
  file: File,
  sheetName: string,
  onProgress?: (percent: number) => void,
): Promise<{ matched: number; unmatched: number }> {
  const formData = new FormData()
  formData.append('sheet_name', sheetName)
  formData.append('file', file)
  return apiUpload('/editor/external-records/load-matches', formData, onProgress)
}

export function overrideMatch(
  id: number,
  patch: { match_status: string; match_confidence?: string | null; matched_venue_id?: string | null },
): Promise<ExternalRecord> {
  return apiPatch(`/editor/external-records/${id}/match`, patch)
}

export function updateReviewStatus(id: number, reviewStatus: string): Promise<ExternalRecord> {
  return apiPatch(`/editor/external-records/${id}/review-status`, { review_status: reviewStatus })
}

export function applyFields(
  id: number,
  fields: string[],
  overrideConflict = false,
): Promise<{ record: ExternalRecord; venue: Venue; fields_applied: string[] }> {
  return apiPostJson(`/editor/external-records/${id}/apply`, { fields, override_conflict: overrideConflict })
}

export function createVenueFromRecord(
  id: number,
  payload: {
    id: string
    name: string
    slug: string
    category: string
    destination_id: string
    short_description?: string | null
    maps_url?: string | null
  },
): Promise<Venue> {
  return apiPostJson(`/editor/external-records/${id}/create-venue`, payload)
}

/** External Data Enrichment Workflow — Destination Mapping. An explicit,
 * operator-created (source, external_destination) -> Studio Destination
 * row — never fuzzy, never inferred by this app. */
export function createDestinationMapping(
  source: string,
  externalDestination: string,
  studioDestinationId: string,
): Promise<{ id: number; source: string; external_destination: string; studio_destination_id: string }> {
  return apiPostJson('/editor/external-destination-mappings', {
    source,
    external_destination: externalDestination,
    studio_destination_id: studioDestinationId,
  })
}
