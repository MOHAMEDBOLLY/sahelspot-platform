export type VenueStatus = 'draft' | 'review' | 'approved' | 'archived'

export interface Venue {
  id: string
  name: string
  category: string
  destination_id: string
  status: VenueStatus
}
