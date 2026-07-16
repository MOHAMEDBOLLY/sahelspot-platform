export type VenueStatus = 'draft' | 'review' | 'approved' | 'archived'

/** [open, close] in "HH:MM" 24h, e.g. ["12:00", "23:00"]. A day can have multiple ranges (split hours). */
export type OpeningHoursRange = [string, string]

export type OpeningHours = Partial<Record<
  'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun',
  OpeningHoursRange[]
>>

export interface DestinationRef {
  id: string
  name: string
}

export interface Venue {
  id: string
  name: string
  slug: string
  destination: DestinationRef
  district: string | null
  category: string
  status: VenueStatus
  is_featured: boolean
  is_verified: boolean
  latitude: string | null
  longitude: string | null
  phone: string | null
  whatsapp: string | null
  website: string | null
  maps_url: string | null
  instagram_handle: string | null
  facebook_handle: string | null
  tiktok_handle: string | null
  short_description: string | null
  cover_image_url: string | null
  gallery_image_urls: string[] | null
  opening_hours: OpeningHours | null
  beach_details: Record<string, unknown> | null
  internal_notes: string | null
  source: string | null
  last_published_at: string | null
  created_at: string
  updated_at: string
}
