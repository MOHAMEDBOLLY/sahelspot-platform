import { apiDelete, apiDownload, apiGet, apiPatch, apiPostJson, apiUpload } from '../../lib/apiClient'
import type { Destination, DestinationListResponse, DestinationSearchParams } from '../../types/destination'

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

/** Exactly the fields Edit Mode exposes as editable — same reasoning as
 * `features/venues/api.ts`'s `VenuePatch`. `id`, `status` (workflow-
 * controlled — no Review/Approval exists for destinations yet, but `status`
 * still isn't a generic text field), `boundary` (a geometry blob with no
 * editor built), and timestamps aren't part of this write path.
 * `cover_image_url` (Sprint 29) is here only so clearing the cover can go
 * through this same patch — same reasoning venues' `VenuePatch` already
 * gives for its own `cover_image_url`. */
export type DestinationPatch = Pick<Destination, 'name' | 'region' | 'aliases' | 'notes' | 'cover_image_url'>

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
  }
}

export function updateDestination(id: string, patch: DestinationPatch): Promise<Destination> {
  return apiPatch<Destination>(`/editor/destinations/${encodeURIComponent(id)}`, patch)
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

/** EP20-T01 — `GET /editor/destinations/export`. */
export function exportDestinations(format: 'csv' | 'json'): Promise<void> {
  return apiDownload(`/editor/destinations/export?format=${format}`, `destinations.${format}`)
}
