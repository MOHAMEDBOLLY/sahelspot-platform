/** STUDIO — NO QR INDEPENDENT ENTITY (Phase 1). A Walk/Mall is its own
 * entity, NOT a Venue — see `api/app/db/models.py`'s `NoQrArea`/
 * `NoQrPlace` docstrings for the full reasoning. Supersedes the legacy
 * `Venue.is_no_qr`/`parent_venue_id`/`no_qr_type` approach (kept
 * temporarily, unused, for backward compatibility — see `types/venue.ts`).
 */
export type NoQrAreaType = 'Walk' | 'Mall'

/** A minimal, read-only reference to an existing Venue — populated only
 * when a place links one; mirrors the backend's `VenueRef` shape (id +
 * name only), not a full `Venue`. */
export type NoQrPlaceVenueRef = {
  id: string
  name: string
}

/** Exactly one of `venue_id`/`name` is ever non-null — enforced by the
 * backend (`ck_no_qr_places_identity`, `validate_no_qr_place_identity`),
 * mirrored here as the type's own shape isn't narrowed further since the
 * API is the single source of truth for which case applies. */
export type NoQrPlace = {
  id: number
  area_id: number
  venue_id: string | null
  name: string | null
  venue: NoQrPlaceVenueRef | null
  created_at: string
  updated_at: string
}

export type NoQrArea = {
  id: number
  name: string
  type: NoQrAreaType
  places: NoQrPlace[]
  created_at: string
  updated_at: string
}
