/** The `/public/*` wire shapes — mirrors `PublishedVenueOut` /
 * `PublishedDestinationOut` (api/app/api/schemas.py) exactly, snake_case
 * included. Never imported by a component: this is the boundary the mapper
 * translates across, not something the UI is meant to know exists.
 *
 * docs/consumer/API_REQUIREMENTS.md tracks every field the UI needs that
 * isn't listed here yet — a Studio publishing requirement, not a client-side
 * addition. */

export interface DestinationRefDTO {
  id: string;
  name: string;
}

export interface PublishedVenueDTO {
  id: string;
  name: string;
  slug: string;
  destination: DestinationRefDTO;
  district: string | null;
  category: string;
  is_featured: boolean;
  is_verified: boolean;
  latitude: string | null;
  longitude: string | null;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  maps_url: string | null;
  instagram_handle: string | null;
  facebook_handle: string | null;
  tiktok_handle: string | null;
  short_description: string | null;
  cover_image_url: string | null;
  gallery_image_urls: string[] | null;
  opening_hours: Record<string, unknown> | null;
  beach_details: Record<string, unknown> | null;
  // Category/Tags/Access Type/Badges/Collections architecture (Phase 1) —
  // mirrors `PublishedVenueOut` (api/app/api/schemas.py) since commit
  // e71880c. No `collections` field here, deliberately, matching the
  // backend model exactly: collection membership isn't embedded per-venue
  // in the snapshot, it's embedded once per collection in
  // `snapshot["collections"]` — see `PublishedCollectionDTO` below, the
  // `GET /public/collections/{slug}` read path for "which venues are in
  // this collection."
  access_type: string | null;
  reservation_policy: string | null;
  tags: string[];
}

export interface PublishedDestinationDTO {
  id: string;
  name: string;
  region: string;
  aliases: string[] | null;
  boundary: Record<string, unknown> | null;
  cover_image_url: string | null;
}

export interface VenueRefDTO {
  id: string;
  name: string;
}

/** Mirrors `PublishedCollectionOut` (api/app/api/schemas.py) — the
 * `GET /public/collections/{slug}` response shape. `venues` arrives
 * already in the collection's curated `sort_order`, resolved server-side
 * (see api/app/api/routes/public.py's `get_published_collection`); the
 * caller never has to re-sort. */
export interface PublishedCollectionDTO {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  venues: PublishedVenueDTO[];
}

/** Mirrors `PublishedEventOut` (api/app/api/schemas.py) — Events Module v1.
 * `phase` ("upcoming" | "live" | "ended") is computed server-side from the
 * date/time fields, never stored and never recomputed here. */
export interface PublishedEventDTO {
  id: string;
  title: string;
  slug: string;
  cover_image_url: string | null;
  short_description: string | null;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  venue: VenueRefDTO | null;
  destination: DestinationRefDTO | null;
  featured: boolean;
  ticket_provider: string | null;
  ticket_url: string | null;
  external_event_id: string | null;
  phase: "upcoming" | "live" | "ended" | null;
}
