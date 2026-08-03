export type ContentStatus = 'draft' | 'review' | 'approved' | 'archived'

/** Never a stored column — derived from start/end date/time on the
 * backend (api/app/api/event_timing.py) and returned as a plain field on
 * every response. Studio never computes this itself. */
export type EventPhase = 'upcoming' | 'live' | 'ended'

export interface EventVenueRef {
  id: string
  name: string
}

export interface EventDestinationRef {
  id: string
  name: string
}

/** Mirrors the backend's EventOut (api/app/api/schemas.py). */
export interface Event {
  id: string
  title: string
  slug: string
  status: ContentStatus
  cover_image_url: string | null
  short_description: string | null
  start_date: string
  end_date: string | null
  start_time: string | null
  end_time: string | null
  venue: EventVenueRef | null
  destination: EventDestinationRef | null
  featured: boolean
  ticket_provider: string | null
  ticket_url: string | null
  external_event_id: string | null
  version: number
  last_published_at: string | null
  created_at: string
  updated_at: string
  phase: EventPhase | null
}

export interface EventListResponse {
  items: Event[]
  total: number
  page: number
  page_size: number
}

export interface EventSearchParams {
  q?: string
  status?: string
  venueId?: string
  destinationId?: string
  featured?: boolean
  page?: number
  pageSize?: number
}

export interface EventBulkResultItem {
  event_id: string
  success: boolean
  error?: string | null
  event?: Event | null
}

export interface EventBulkOperationResponse {
  results: EventBulkResultItem[]
  succeeded: number
  failed: number
}
