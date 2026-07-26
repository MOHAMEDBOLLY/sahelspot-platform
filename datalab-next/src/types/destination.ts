export type ContentStatus = 'draft' | 'review' | 'approved' | 'archived'

/** Mirrors the backend's DestinationOut (api/app/api/schemas.py) — the full
 * record, as returned by both GET /destinations and GET /destinations/{id}. */
export interface Destination {
  id: string
  name: string
  region: string
  status: ContentStatus
  aliases: string[] | null
  boundary: Record<string, unknown> | null
  notes: string | null
  cover_image_url: string | null
  last_published_at: string | null
  created_at: string
  updated_at: string
}

/** Sprint 29 — mirrors `DestinationListOut` (api/app/api/schemas.py). */
export interface DestinationListResponse {
  items: Destination[]
  total: number
  page: number
  page_size: number
}

export interface DestinationSearchParams {
  q?: string
  page?: number
  pageSize?: number
}
