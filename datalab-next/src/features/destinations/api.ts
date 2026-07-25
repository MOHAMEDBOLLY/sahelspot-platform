import { apiGet, apiPatch } from '../../lib/apiClient'
import type { Destination } from '../../types/destination'

export function fetchDestinations(): Promise<Destination[]> {
  return apiGet<Destination[]>('/editor/destinations')
}

export function fetchDestination(id: string): Promise<Destination> {
  return apiGet<Destination>(`/editor/destinations/${encodeURIComponent(id)}`)
}

/** Exactly the fields Edit Mode exposes as editable — same reasoning as
 * `features/venues/api.ts`'s `VenuePatch`. `id`, `status` (workflow-
 * controlled — no Review/Approval exists for destinations yet, but `status`
 * still isn't a generic text field), `boundary` (a geometry blob with no
 * editor built), and timestamps aren't part of this write path. */
export type DestinationPatch = Pick<Destination, 'name' | 'region' | 'aliases' | 'notes'>

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
  }
}

export function updateDestination(id: string, patch: DestinationPatch): Promise<Destination> {
  return apiPatch<Destination>(`/editor/destinations/${encodeURIComponent(id)}`, patch)
}
