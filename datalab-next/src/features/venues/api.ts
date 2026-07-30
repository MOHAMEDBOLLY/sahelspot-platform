import { apiDeleteJson, apiDownload, apiGet, apiPatch, apiPost, apiPostJson, apiUpload } from '../../lib/apiClient'
import type { BulkOperationResponse, Venue, VenueListResponse, VenueSearchParams } from '../../types/venue'
import type { ValidationResult } from '../../types/validation'

/** Sprint 27 — Search & Filter Foundation. All params are optional and
 * combine with AND semantics server-side. `page`/`pageSize` exist so the
 * response shape (`VenueListResponse`, not a bare array) can support real
 * pagination controls later without another shape change — this sprint's
 * frontend doesn't build page-by-page navigation, just search/filter, so
 * it requests one generously-sized page (see `useVenues`). */
export function fetchVenues(params: VenueSearchParams = {}): Promise<VenueListResponse> {
  const searchParams = new URLSearchParams()
  if (params.q) searchParams.set('q', params.q)
  if (params.destinationId) searchParams.set('destination_id', params.destinationId)
  if (params.category) searchParams.set('category', params.category)
  if (params.status) searchParams.set('status', params.status)
  searchParams.set('page', String(params.page ?? 1))
  searchParams.set('page_size', String(params.pageSize ?? 50))

  const query = searchParams.toString()
  return apiGet<VenueListResponse>(`/editor/venues${query ? `?${query}` : ''}`)
}

export function fetchVenue(id: string): Promise<Venue> {
  return apiGet<Venue>(`/editor/venues/${encodeURIComponent(id)}`)
}

/** Reuses the existing `GET /editor/venues/export?format=json` endpoint
 * (already deployed for file download via `exportVenues` below) to fetch
 * every venue unpaginated, for client-side dashboard aggregation. No new
 * backend route — same data the CSV/JSON download already returns. */
export function fetchAllVenues(): Promise<Venue[]> {
  return apiGet<Venue[]>('/editor/venues/export?format=json')
}

/** Exactly the fields Edit Mode exposes as editable — see the workspace
 * sections. Everything else (id, slug, destination, status, timestamps, ...)
 * is structural or workflow-controlled and isn't part of Save Draft.
 * `cover_image_url`/`gallery_image_urls` (Sprint 25) are here only so
 * removing a gallery image or clearing the cover can go through this same
 * patch — they're not exposed as free-text inputs anywhere. */
export type VenuePatch = Pick<
  Venue,
  | 'name'
  | 'category'
  | 'district'
  | 'is_featured'
  | 'is_verified'
  | 'short_description'
  | 'latitude'
  | 'longitude'
  | 'maps_url'
  | 'phone'
  | 'whatsapp'
  | 'website'
  | 'instagram_handle'
  | 'facebook_handle'
  | 'tiktok_handle'
  | 'internal_notes'
  | 'cover_image_url'
  | 'gallery_image_urls'
  | 'beach_details'
  | 'translations'
>

/** Empty strings from cleared text inputs mean "no value" for these nullable
 * fields, same as the API's own null columns — not the literal string "". */
function emptyToNull(value: string | null): string | null {
  return value === '' ? null : value
}

export function toVenuePatch(venue: Venue): VenuePatch {
  return {
    name: venue.name,
    category: venue.category,
    district: emptyToNull(venue.district),
    is_featured: venue.is_featured,
    is_verified: venue.is_verified,
    short_description: emptyToNull(venue.short_description),
    latitude: emptyToNull(venue.latitude),
    longitude: emptyToNull(venue.longitude),
    maps_url: emptyToNull(venue.maps_url),
    phone: emptyToNull(venue.phone),
    whatsapp: emptyToNull(venue.whatsapp),
    website: emptyToNull(venue.website),
    instagram_handle: emptyToNull(venue.instagram_handle),
    facebook_handle: emptyToNull(venue.facebook_handle),
    tiktok_handle: emptyToNull(venue.tiktok_handle),
    internal_notes: emptyToNull(venue.internal_notes),
    cover_image_url: venue.cover_image_url,
    gallery_image_urls: venue.gallery_image_urls,
    // Mirrors the backend's own gate (validate_beach_details_shape):
    // beach_details may only be set when category is 'Beach' — cleared
    // here so switching away from Beach in the editor can't submit a
    // stale value the backend would reject with invalid_beach_details.
    beach_details: venue.category === 'Beach' ? venue.beach_details : null,
    translations: venue.translations,
  }
}

/** EP22 — `version` is the venue's currently-loaded version, sent as
 * `If-Match` (PLATFORM_SPEC_v1.0_FROZEN.md §4). A mismatch means someone
 * else saved since this caller last read the venue; the backend responds
 * `409` (surfaced as `ApiError` with `status === 409`), which callers use
 * to offer a reload rather than silently overwriting or losing the edit. */
export function updateVenue(id: string, version: number, patch: VenuePatch): Promise<Venue> {
  return apiPatch<Venue>(`/editor/venues/${encodeURIComponent(id)}`, patch, { 'If-Match': String(version) })
}

/** EP19-T01 — the one write path venues never had, `POST /editor/venues`.
 * `id`/`slug` are caller-supplied (mirrors the backend's own reasoning,
 * see `VenueCreate`'s docstring) — every new venue starts `draft`, so
 * `status` isn't part of this input. */
export interface VenueCreateInput {
  id: string
  name: string
  slug: string
  destination_id: string
  category: string
  district?: string | null
  beach_details?: Record<string, unknown> | null
}

export function createVenue(input: VenueCreateInput): Promise<Venue> {
  return apiPostJson<Venue>('/editor/venues', input)
}

/** Sprint 25 — Media Library Foundation. Uploads an image and returns the
 * updated venue: the server sets `cover_image_url` (slot "cover") or
 * appends to `gallery_image_urls` (slot "gallery") in the same request,
 * so there's no separate "now associate this URL" step. `onProgress`
 * (Sprint 26) is optional — every existing call site keeps working
 * unchanged without it. */
export type MediaSlot = 'cover' | 'gallery'

export function uploadVenueMedia(
  id: string,
  file: File,
  slot: MediaSlot,
  onProgress?: (percent: number) => void,
): Promise<Venue> {
  const formData = new FormData()
  formData.append('slot', slot)
  formData.append('file', file)
  return apiUpload<Venue>(`/editor/venues/${encodeURIComponent(id)}/media`, formData, onProgress)
}

/** Sprint 26 — promotes an existing gallery image to cover without a
 * re-upload. `url` must already be one of the venue's `gallery_image_urls`
 * (enforced server-side); the image stays in the gallery too. */
export function setCoverFromGallery(id: string, url: string): Promise<Venue> {
  return apiPostJson<Venue>(`/editor/venues/${encodeURIComponent(id)}/media/set-cover`, { url })
}

/** EP20-T02 — deletes the stored file (not just the reference) via
 * `DELETE .../media` (api/app/media/service.py's `delete_image`), unlike
 * a plain `PATCH` clearing the field, which would only unlink it and
 * leave the file orphaned in storage. */
export function deleteVenueCoverImage(id: string): Promise<Venue> {
  return apiDeleteJson<Venue>(`/editor/venues/${encodeURIComponent(id)}/media?slot=cover`)
}

export function deleteVenueGalleryImage(id: string, url: string): Promise<Venue> {
  return apiDeleteJson<Venue>(
    `/editor/venues/${encodeURIComponent(id)}/media?slot=gallery&url=${encodeURIComponent(url)}`,
  )
}

/** Runs the canonical Validate gate against the venue's persisted draft
 * state (api/app/validation/venues.py) — read-only, doesn't change status. */
export function validateVenue(id: string): Promise<ValidationResult> {
  return apiPost<ValidationResult>(`/editor/venues/${encodeURIComponent(id)}/validate`)
}

/** Review — the first editorial state transition (`draft` -> `review`).
 * Rejects with a structured error (409 wrong status, 422 not ready) rather
 * than performing the transition unconditionally. */
export function submitVenueForReview(id: string): Promise<Venue> {
  return apiPost<Venue>(`/editor/venues/${encodeURIComponent(id)}/submit-for-review`)
}

/** Approval — the second editorial state transition (`review` -> `approved`).
 * A human editorial decision, not a re-run of Validate — rejects with a
 * structured 409 if the venue isn't currently `review`. */
export function approveVenue(id: string): Promise<Venue> {
  return apiPost<Venue>(`/editor/venues/${encodeURIComponent(id)}/approve`)
}

/** EP21 — Reject (`review` -> `draft`), the counterpart to Approve. Same
 * human editorial decision, requires a non-blank `reason` (enforced by
 * the shared `RejectRequest` schema — a bare Pydantic 422, not a
 * structured one, so there's nothing extra to special-case here). */
export function rejectVenue(id: string, reason: string): Promise<Venue> {
  return apiPostJson<Venue>(`/editor/venues/${encodeURIComponent(id)}/reject`, { reason })
}

/** Sprint 28 — Bulk Operations. Every bulk endpoint returns the same
 * `BulkOperationResponse` shape (one result row per id) regardless of
 * whether it's a read-only check or a mutation — partial failure is
 * normal, not an error the caller needs to catch, so none of these throw
 * on a per-item failure the way the single-item actions above do. */
export function bulkValidateVenues(venueIds: string[]): Promise<BulkOperationResponse> {
  return apiPostJson<BulkOperationResponse>('/editor/venues/bulk/validate', { venue_ids: venueIds })
}

export function bulkSubmitVenuesForReview(venueIds: string[]): Promise<BulkOperationResponse> {
  return apiPostJson<BulkOperationResponse>('/editor/venues/bulk/submit-for-review', {
    venue_ids: venueIds,
  })
}

export function bulkApproveVenues(venueIds: string[]): Promise<BulkOperationResponse> {
  return apiPostJson<BulkOperationResponse>('/editor/venues/bulk/approve', { venue_ids: venueIds })
}

/** EP15 unified `PATCH /editor/venues/bulk` — replaces the two
 * single-field endpoints (`bulk/category`, `bulk/destination`) this
 * frontend used to call, which no longer exist (Phase 2 removed them,
 * see PLATFORM_SPEC_v1.0_FROZEN.md §7.6). Either field, or both, can be
 * sent in one call; each of the two functions below sends just the one
 * it's named for. */
export function bulkUpdateVenueCategory(
  venueIds: string[],
  category: string,
): Promise<BulkOperationResponse> {
  return apiPatch<BulkOperationResponse>('/editor/venues/bulk', {
    venue_ids: venueIds,
    category,
  })
}

export function bulkUpdateVenueDestination(
  venueIds: string[],
  destinationId: string,
): Promise<BulkOperationResponse> {
  return apiPatch<BulkOperationResponse>('/editor/venues/bulk', {
    venue_ids: venueIds,
    destination_id: destinationId,
  })
}

/** EP20-T01 — `GET /editor/venues/export`. */
export function exportVenues(format: 'csv' | 'json'): Promise<void> {
  return apiDownload(`/editor/venues/export?format=${format}`, `venues.${format}`)
}
