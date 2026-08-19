import type { ValidationResult } from './validation'
import type { QualityFilterParams } from '../lib/venueQualityFilter'

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
  /** Booking CTA Fields (Phase 1) — external booking links, same plain
   * shape as every other contact/social field above. SahelSpot is not
   * the booking engine: Consumer will just open this URL, no internal
   * flow. Studio gates which single field an editor sees per venue by
   * category (Beach Club/Nightlife) or category+tag
   * (Restaurant+'fine-dining') — see `BookingSection.tsx`. */
  reserve_your_spot_beach_url: string | null
  reserve_your_table_url: string | null
  reserve_your_spot_nightlife_url: string | null
  short_description: string | null
  cover_image_url: string | null
  gallery_image_urls: string[] | null
  opening_hours: OpeningHours | null
  beach_details: Record<string, unknown> | null
  /** Category/Tags/Access Type/Badges/Collections architecture (Phase 1) —
   * plain nullable fields, independent of category (a paid-entry restaurant
   * is exactly as valid as a QR-gated beach). See api/app/db/models.py's
   * ACCESS_TYPES/RESERVATION_POLICIES for the fixed vocabularies. */
  access_type: string | null
  reservation_policy: string | null
  /** Studio Content Organization (Beaches + No QR) — is this venue itself
   * an explicitly designated No QR discovery place (a Walk, a Mall, a
   * standalone roadside spot)? `false` by default, only ever set `true`
   * by an explicit editor action. Deliberately NOT derived from
   * `access_type !== 'QR Required'` — a different concept (the access
   * method a venue requires), still correctly served as-is by
   * `GET /public/discover/no-qr`. See api/app/db/models.py's
   * `Venue.is_no_qr` docstring. */
  is_no_qr: boolean
  /** Optional self-referential parent (e.g. a shop inside "Zahra Walk").
   * `null` is the common case. Per product decision, a venue may only be
   * used as a parent if its own `is_no_qr` is `true` — enforced by the
   * backend (`validate_parent_venue_id`), not just the Studio picker UI.
   * A No QR venue with no `parent_venue_id` that nothing else points to
   * is "Standalone"; one other venues point to is a "Parent Area" — both
   * derived client-side (`features/noQr`), not a second stored flag. See
   * api/app/db/models.py's `Venue.parent_venue_id` docstring. */
  parent_venue_id: string | null
  /** STUDIO — BEACHES + NO QR FOUNDATION (migration 0019, prepared/not
   * applied) — a designated No QR parent's kind. `null` until an editor
   * explicitly classifies it; only ever meaningful when `is_no_qr` is
   * `true` (enforced by the backend's `ck_venues_no_qr_type` constraint
   * and `validate_no_qr_type`). See api/app/db/models.py's
   * `Venue.no_qr_type` docstring. */
  no_qr_type: 'Walk' | 'Mall' | null
  /** Read-only here — tag slugs currently assigned to this venue. Written
   * via `tag_ids` on `VenueUpdate`/`VenuePatch` (see features/venues/api.ts),
   * not through this field directly; the backend attaches it as a computed
   * value (see `_attach_taxonomy`, api/app/api/routes/venues.py). */
  tags: string[]
  /** Same read/write asymmetry as `tags` above, via `collection_ids`. */
  collections: string[]
  internal_notes: string | null
  source: string | null
  /** Brand Asset Propagation — free text, never inferred from `name`.
   * Two venues are "the same brand" purely by this value matching
   * exactly (case-sensitive), same reasoning as the backend column
   * (app/db/models.py's `Venue.brand`). */
  brand: string | null
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
 * is the one naming translation `fetchVenues` does).
 *
 * `qualityFilter` (Phase 2 Quality Center) is the one field here with no
 * backend equivalent — `fetchVenues` never reads it, so passing it through
 * this same params object is safe; it's only consumed by `useVenueSearch`'s
 * client-side path. Kept as a nested object (not flattened `missing`/
 * `maxCompletion` fields) so its optionality is a single check, not two. */
export interface VenueSearchParams {
  q?: string
  destinationId?: string
  category?: string
  status?: string
  brand?: string
  page?: number
  pageSize?: number
  qualityFilter?: QualityFilterParams
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
