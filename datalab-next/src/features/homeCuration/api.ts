import { apiGet, apiPatch, apiDelete, apiDeleteJson, apiPostJson } from '../../lib/apiClient'
import type { Collection } from '../../types/homeCuration'

/** HOME CURATION. Thin wrapper over `/editor/collections`, same "no
 * client-side reshaping" pattern `features/noQr/api.ts`/`features/venues/
 * api.ts` already establish. No `If-Match`/version handling — `Collection`
 * has no optimistic-concurrency column, same as `NoQrArea`. */

export function fetchCollections(): Promise<Collection[]> {
  return apiGet('/editor/collections')
}

export function fetchCollection(id: string): Promise<Collection> {
  return apiGet(`/editor/collections/${encodeURIComponent(id)}`)
}

export function createCollection(id: string, name: string): Promise<Collection> {
  return apiPostJson('/editor/collections', { id, name })
}

export function updateCollection(
  id: string,
  patch: { name?: string; description?: string | null; is_active?: boolean; sort_order?: number },
): Promise<Collection> {
  return apiPatch(`/editor/collections/${encodeURIComponent(id)}`, patch)
}

export function deleteCollection(id: string): Promise<void> {
  return apiDelete(`/editor/collections/${encodeURIComponent(id)}`)
}

export function addCollectionVenue(collectionId: string, venueId: string): Promise<Collection> {
  return apiPostJson(`/editor/collections/${encodeURIComponent(collectionId)}/venues`, { venue_id: venueId })
}

export function reorderCollectionVenue(
  collectionId: string,
  venueId: string,
  sortOrder: number,
): Promise<Collection> {
  return apiPatch(
    `/editor/collections/${encodeURIComponent(collectionId)}/venues/${encodeURIComponent(venueId)}`,
    { sort_order: sortOrder },
  )
}

export function removeCollectionVenue(collectionId: string, venueId: string): Promise<Collection> {
  return apiDeleteJson(
    `/editor/collections/${encodeURIComponent(collectionId)}/venues/${encodeURIComponent(venueId)}`,
  )
}
