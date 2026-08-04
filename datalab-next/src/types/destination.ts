export type ContentStatus = 'draft' | 'review' | 'approved' | 'archived'

/** Mirrors the backend's DestinationOut (api/app/api/schemas.py) — the full
 * record, as returned by both GET /destinations and GET /destinations/{id}. */
export interface Destination {
  id: string
  name: string
  region: string
  status: ContentStatus
  aliases: string[] | null
  boundary: Record<string, unknown> | null
  notes: string | null
  cover_image_url: string | null
  /** PLATFORM_SPEC_v1.0_FROZEN.md §4 — optimistic concurrency, same
   * reasoning as `Venue.version`. */
  version: number
  /** PLATFORM_SPEC_v1.0_FROZEN.md §5 — same reasoning as `Venue.translations`. */
  translations: Record<string, { name?: string }> | null
  last_published_at: string | null
  created_at: string
  updated_at: string
}

/** Sprint 29 — mirrors `DestinationListOut` (api/app/api/schemas.py). */
export interface DestinationListResponse {
  items: Destination[]
  total: number
  page: number
  page_size: number
}

export interface DestinationSearchParams {
  q?: string
  page?: number
  pageSize?: number
}

/** Destination Lifecycle Management — mirrors venues' `BulkResultItem`/
 * `BulkOperationResponse` (types/venue.ts), with `destination`/
 * `destination_id` in place of `venue`/`venue_id`. */
export interface BulkDestinationResultItem {
  destination_id: string
  success: boolean
  error: string | null
  destination: Destination | null
}

export interface BulkDestinationOperationResponse {
  results: BulkDestinationResultItem[]
  succeeded: number
  failed: number
}
