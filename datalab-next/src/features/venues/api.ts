import { apiGet, apiPatch, apiPost, apiUpload } from '../../lib/apiClient'
import type { Venue } from '../../types/venue'
import type { ValidationResult } from '../../types/validation'

export function fetchVenues(): Promise<Venue[]> {
  return apiGet<Venue[]>('/editor/venues')
}

export function fetchVenue(id: string): Promise<Venue> {
  return apiGet<Venue>(`/editor/venues/${encodeURIComponent(id)}`)
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
  }
}

export function updateVenue(id: string, patch: VenuePatch): Promise<Venue> {
  return apiPatch<Venue>(`/editor/venues/${encodeURIComponent(id)}`, patch)
}

/** Sprint 25 — Media Library Foundation. Uploads an image and returns the
 * updated venue: the server sets `cover_image_url` (slot "cover") or
 * appends to `gallery_image_urls` (slot "gallery") in the same request,
 * so there's no separate "now associate this URL" step. */
export type MediaSlot = 'cover' | 'gallery'

export function uploadVenueMedia(id: string, file: File, slot: MediaSlot): Promise<Venue> {
  const formData = new FormData()
  formData.append('slot', slot)
  formData.append('file', file)
  return apiUpload<Venue>(`/editor/venues/${encodeURIComponent(id)}/media`, formData)
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
