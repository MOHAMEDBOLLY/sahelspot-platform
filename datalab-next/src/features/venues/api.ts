import { apiGet, apiPatch } from '../../lib/apiClient'
import type { Venue } from '../../types/venue'

export function fetchVenues(): Promise<Venue[]> {
  return apiGet<Venue[]>('/venues')
}

export function fetchVenue(id: string): Promise<Venue> {
  return apiGet<Venue>(`/venues/${encodeURIComponent(id)}`)
}

/** Exactly the fields Edit Mode exposes as editable — see the workspace
 * sections. Everything else (id, slug, destination, status, timestamps, ...)
 * is structural or workflow-controlled and isn't part of Save Draft. */
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
  }
}

export function updateVenue(id: string, patch: VenuePatch): Promise<Venue> {
  return apiPatch<Venue>(`/venues/${encodeURIComponent(id)}`, patch)
}
