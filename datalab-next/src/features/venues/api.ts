import { apiGet } from '../../lib/apiClient'
import type { Venue } from '../../types/venue'

export function fetchVenues(): Promise<Venue[]> {
  return apiGet<Venue[]>('/venues')
}

export function fetchVenue(id: string): Promise<Venue> {
  return apiGet<Venue>(`/venues/${encodeURIComponent(id)}`)
}
