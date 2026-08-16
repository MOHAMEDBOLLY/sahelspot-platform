/** HOME CURATION. Extends the existing `Collection`/`CollectionVenue`
 * model (see api/app/db/models.py — unchanged) with real Studio CRUD.
 * `venues` is a resolved, ordered membership list — the Venue itself
 * remains the sole source of truth for every field beyond id/name. */
export type CollectionVenueRef = {
  id: string
  name: string
}

export type CollectionVenue = {
  venue_id: string
  sort_order: number
  venue: CollectionVenueRef | null
}

export type Collection = {
  id: string
  slug: string
  name: string
  description: string | null
  is_active: boolean
  sort_order: number
  venues: CollectionVenue[]
}
