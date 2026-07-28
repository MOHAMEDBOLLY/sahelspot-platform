import type { ValidationResult } from './validation'

export type VenueStatus = 'draft' | 'review' | 'approved' | 'archived'

/** [open, close] in "HH:MM" 24h, e.g. ["12:00", "23:00"]. A day can have multiple ranges (split hours). */
export type OpeningHoursRange = [string, string]

export type OpeningHours = Partial<Record<
  'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun',
  OpeningHoursRange[]
>>

export interface DestinationRef {
  id: string
  name: string
}

export interface Venue {
  id: string
  name: string
  slug: string
  destination: DestinationRef
  district: string | null
  category: string
  status: VenueStatus
  /** PLATFORM_SPEC_v1.0_FROZEN.md §4 — optimistic concurrency. The value
   * a `PATCH`'s `If-Match` header must match; increments by one on every
   * successful write (see api/app/api/concurrency.py). */
  version: number
  /** PLATFORM_SPEC_v1.0_FROZEN.md §5 — i18n via a `translations` JSONB
   * column; `{"<locale>": {"name": ...}}`, canonical `name` remains the
   * fallback. EP23 exposes just `translations.ar.name` as an optional
   * edit-mode field — no other locale/field combination has an editor
   * built yet. */
  translations: Record<string, { name?: string }> | null
  is_featured: boolean
  is_verified: boolean
  latitude: string | null
  longitude: string | null
  phone: string | null
  whatsapp: string | null
  website: string | null
  maps_url: string | null
  instagram_handle: string | null
  facebook_handle: string | null
  tiktok_handle: string | null
  short_description: string | null
  cover_image_url: string | null
  gallery_image_urls: string[] | null
  opening_hours: OpeningHours | null
  beach_details: Record<string, unknown> | null
  internal_notes: string | null
  source: string | null
  last_published_at: string | null
  created_at: string
  updated_at: string
}

/** Sprint 27 — `GET /venues`'s response shape, mirrors `VenueListOut`
 * (`api/app/api/schemas.py`). */
export interface VenueListResponse {
  items: Venue[]
  total: number
  page: number
  page_size: number
}

/** All optional — an unset field means "don't filter on this." Matches
 * the backend's query params exactly (`destinationId` -> `destination_id`
 * is the one naming translation `fetchVenues` does). */
export interface VenueSearchParams {
  q?: string
  destinationId?: string
  category?: string
  status?: string
  page?: number
  pageSize?: number
}

/** Sprint 28 — Bulk Operations. Mirrors `BulkResultItem`/`BulkOperationResponse`
 * (`api/app/api/schemas.py`) — the one shared shape every bulk endpoint
 * returns, whether it's a validation check or a mutation. */
export interface BulkResultItem {
  venue_id: string
  success: boolean
  error: string | null
  venue: Venue | null
  validation: ValidationResult | null
}

export interface BulkOperationResponse {
  results: BulkResultItem[]
  succeeded: number
  failed: number
}
