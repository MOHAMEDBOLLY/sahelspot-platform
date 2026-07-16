import { apiGet } from '../../lib/apiClient'
import type { Venue } from '../../types/venue'

export function fetchVenues(): Promise<Venue[]> {
  return apiGet<Venue[]>('/venues')
}
