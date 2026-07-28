/** Mirrors the backend's PublishRevisionOut (api/app/api/schemas.py) —
 * revision metadata only, no snapshot. */
export interface PublishRevisionSummary {
  id: number
  is_current: boolean
  published_at: string
  published_by: string | null
  label: string | null
  destination_count: number | null
  venue_count: number | null
  excluded_venue_count: number
}

/** The subset of a snapshot destination/venue worth showing in a read-only
 * summary — not the full editorial record, just enough to identify what
 * was published. */
export interface SnapshotDestination {
  id: string
  name: string
  region: string
}

export interface SnapshotVenue {
  id: string
  name: string
  category: string
  destination_id: string
}

export interface PublishRevisionSnapshot {
  destinations: SnapshotDestination[]
  venues: SnapshotVenue[]
}

/** Mirrors PublishRevisionDetail — metadata plus the frozen snapshot. */
export interface PublishRevisionDetail extends PublishRevisionSummary {
  snapshot: PublishRevisionSnapshot
}
