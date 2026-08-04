import { apiDelete, apiDownload, apiGet, apiPatch, apiPost, apiPostJson, apiUpload } from '../../lib/apiClient'
import type {
  BulkDestinationOperationResponse,
  Destination,
  DestinationListResponse,
  DestinationSearchParams,
} from '../../types/destination'

/** Sprint 29 — same search + pagination shape venues' `fetchVenues` already
 * has (Sprint 27). No `status`/other filter — destinations have nothing
 * equivalent to venues' category/destination filters, and none was in
 * this sprint's scope. */
export function fetchDestinations(params: DestinationSearchParams = {}): Promise<DestinationListResponse> {
  const searchParams = new URLSearchParams()
  if (params.q) searchParams.set('q', params.q)
  searchParams.set('page', String(params.page ?? 1))
  searchParams.set('page_size', String(params.pageSize ?? 50))

  return apiGet<DestinationListResponse>(`/editor/destinations?${searchParams.toString()}`)
}

export function fetchDestination(id: string): Promise<Destination> {
  return apiGet<Destination>(`/editor/destinations/${encodeURIComponent(id)}`)
}

/** Reuses the existing `GET /editor/destinations/export?format=json`
 * endpoint (already deployed for file download, see `exportDestinations`
 * below) to fetch every destination unpaginated, for client-side dashboard
 * aggregation. No new backend route. */
export function fetchAllDestinations(): Promise<Destination[]> {
  return apiGet<Destination[]>('/editor/destinations/export?format=json')
}

/** Exactly the fields Edit Mode exposes as editable — same reasoning as
 * `features/venues/api.ts`'s `VenuePatch`. `id`, `status` (workflow-
 * controlled via `submitDestinationForReview`/`approveDestination`/
 * `rejectDestination` below, not a generic text field), `boundary` (a
 * geometry blob with no editor built), and timestamps aren't part of
 * this write path.
 * `cover_image_url` (Sprint 29) is here only so clearing the cover can go
 * through this same patch — same reasoning venues' `VenuePatch` already
 * gives for its own `cover_image_url`. */
export type DestinationPatch = Pick<
  Destination,
  'name' | 'region' | 'aliases' | 'notes' | 'cover_image_url' | 'translations'
>

/** Empty strings from cleared text inputs mean "no value" for nullable
 * fields — same convention `toVenuePatch` already established. */
function emptyToNull(value: string | null): string | null {
  return value === '' ? null : value
}

export function toDestinationPatch(destination: Destination): DestinationPatch {
  return {
    name: destination.name,
    region: destination.region,
    aliases: destination.aliases,
    notes: emptyToNull(destination.notes),
    cover_image_url: destination.cover_image_url,
    translations: destination.translations,
  }
}

/** EP22 — same `If-Match`/`version` reasoning as venues' `updateVenue`. */
export function updateDestination(id: string, version: number, patch: DestinationPatch): Promise<Destination> {
  return apiPatch<Destination>(`/editor/destinations/${encodeURIComponent(id)}`, patch, {
    'If-Match': String(version),
  })
}

/** Sprint 29 — Destination CRUD Parity. `id` is the destination's slug,
 * its actual primary key (see `DestinationCreate`'s backend docstring) —
 * supplied by the caller, not generated here. */
export interface DestinationCreateInput {
  id: string
  name: string
  region: string
  aliases?: string[] | null
  notes?: string | null
}

export function createDestination(input: DestinationCreateInput): Promise<Destination> {
  return apiPostJson<Destination>('/editor/destinations', input)
}

export function deleteDestination(id: string): Promise<void> {
  return apiDelete(`/editor/destinations/${encodeURIComponent(id)}`)
}

/** Cover only — no `slot` param the way venues' upload takes one, since
 * destinations don't have a gallery to choose between. Reuses the same
 * `apiUpload` (XHR, progress-capable) venues' upload already uses. */
export function uploadDestinationCover(
  id: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<Destination> {
  const formData = new FormData()
  formData.append('file', file)
  return apiUpload<Destination>(`/editor/destinations/${encodeURIComponent(id)}/media`, formData, onProgress)
}

/** Destination workflow parity (Phase 2, EP9) — the same `draft -> review
 * -> approved` state machine venues have always had, via the same-shaped
 * endpoints. Never wired into Studio's UI until now; the backend has
 * supported it since Phase 2. */
export function submitDestinationForReview(id: string): Promise<Destination> {
  return apiPost<Destination>(`/editor/destinations/${encodeURIComponent(id)}/submit-for-review`)
}

export function approveDestination(id: string): Promise<Destination> {
  return apiPost<Destination>(`/editor/destinations/${encodeURIComponent(id)}/approve`)
}

/** EP21 — Reject (`review` -> `draft`), same shape/reasoning as venues'
 * `rejectVenue`. */
export function rejectDestination(id: string, reason: string): Promise<Destination> {
  return apiPostJson<Destination>(`/editor/destinations/${encodeURIComponent(id)}/reject`, { reason })
}

/** EP20-T01 — `GET /editor/destinations/export`. */
export function exportDestinations(format: 'csv' | 'json'): Promise<void> {
  return apiDownload(`/editor/destinations/export?format=${format}`, `destinations.${format}`)
}

/** Destination Lifecycle Management — same shape as venues'
 * `moveVenueToDraft`/`archiveVenue`/`restoreVenue`/`deleteVenue` and their
 * bulk-* siblings (`features/venues/api.ts`). */
export function moveDestinationToDraft(id: string): Promise<Destination> {
  return apiPost<Destination>(`/editor/destinations/${encodeURIComponent(id)}/move-to-draft`)
}

export function archiveDestination(id: string): Promise<Destination> {
  return apiPost<Destination>(`/editor/destinations/${encodeURIComponent(id)}/archive`)
}

export function restoreDestination(id: string): Promise<Destination> {
  return apiPost<Destination>(`/editor/destinations/${encodeURIComponent(id)}/restore`)
}

export function bulkMoveDestinationsToDraft(destinationIds: string[]): Promise<BulkDestinationOperationResponse> {
  return apiPostJson<BulkDestinationOperationResponse>('/editor/destinations/bulk/move-to-draft', {
    destination_ids: destinationIds,
  })
}

export function bulkArchiveDestinations(destinationIds: string[]): Promise<BulkDestinationOperationResponse> {
  return apiPostJson<BulkDestinationOperationResponse>('/editor/destinations/bulk/archive', {
    destination_ids: destinationIds,
  })
}

export function bulkRestoreDestinations(destinationIds: string[]): Promise<BulkDestinationOperationResponse> {
  return apiPostJson<BulkDestinationOperationResponse>('/editor/destinations/bulk/restore', {
    destination_ids: destinationIds,
  })
}

export function bulkDeleteDestinations(destinationIds: string[]): Promise<BulkDestinationOperationResponse> {
  return apiPostJson<BulkDestinationOperationResponse>('/editor/destinations/bulk/delete', {
    destination_ids: destinationIds,
  })
}
