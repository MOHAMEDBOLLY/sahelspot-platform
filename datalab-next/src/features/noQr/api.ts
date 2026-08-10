import { apiDelete, apiGet, apiPatch, apiPostJson } from '../../lib/apiClient'
import type { NoQrArea, NoQrAreaType } from '../../types/noQrArea'

/** STUDIO — NO QR INDEPENDENT ENTITY (Phase 1). Mirrors the backend's
 * `/editor/no-qr-areas`/`/editor/no-qr-places` shape 1:1 — no client-side
 * reshaping, same "thin wrapper" pattern `features/venues/api.ts` and
 * `features/events/*` already establish. No `If-Match`/version handling:
 * unlike Venue/Event, `NoQrArea`/`NoQrPlace` have no optimistic-
 * concurrency column (not asked for in Phase 1). */

export function fetchNoQrAreas(): Promise<{ items: NoQrArea[] }> {
  return apiGet('/editor/no-qr-areas')
}

export function fetchNoQrArea(id: number): Promise<NoQrArea> {
  return apiGet(`/editor/no-qr-areas/${id}`)
}

export function createNoQrArea(name: string, type: NoQrAreaType): Promise<NoQrArea> {
  return apiPostJson('/editor/no-qr-areas', { name, type })
}

export function renameNoQrArea(id: number, name: string): Promise<NoQrArea> {
  return apiPatch(`/editor/no-qr-areas/${id}`, { name })
}

export function deleteNoQrArea(id: number): Promise<void> {
  return apiDelete(`/editor/no-qr-areas/${id}`)
}

/** Exactly one of `venueId`/`name` — the caller picks which branch of
 * "Select Existing Venue" vs. "Add New Place" the editor took; this
 * layer doesn't decide, it just forwards whichever one is set, same as
 * the backend's own `NoQrPlaceCreate` shape. */
export function addNoQrPlace(
  areaId: number,
  place: { venueId: string; name?: undefined } | { venueId?: undefined; name: string },
): Promise<NoQrArea['places'][number]> {
  return apiPostJson(`/editor/no-qr-areas/${areaId}/places`, {
    venue_id: place.venueId ?? null,
    name: place.name ?? null,
  })
}

export function renameNoQrPlace(placeId: number, name: string): Promise<NoQrArea['places'][number]> {
  return apiPatch(`/editor/no-qr-places/${placeId}`, { name, venue_id: null })
}

export function removeNoQrPlace(placeId: number): Promise<void> {
  return apiDelete(`/editor/no-qr-places/${placeId}`)
}
