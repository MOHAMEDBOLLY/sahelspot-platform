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

/** Mirrors `PublishedHomeCollectionOut` (api/app/api/schemas.py) — the
 * `GET /public/collections` response shape (Consumer Home Curation
 * Integration V2). Same fields as `PublishedCollectionDTO` plus
 * `sort_order`: this collection's 0-based position among the Home
 * Curation collections only (not its raw DB `Collection.sort_order`,
 * which is scoped across every collection including ones outside Home
 * Curation) — the one piece of information the single-slug endpoint never
 * exposed, and the reason this endpoint exists. */
export interface PublishedHomeCollectionDTO {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sort_order: number;
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

/** Same lightweight id+name shape `VenueRefDTO` already gives Events —
 * named separately per No QR's own type, but structurally identical, not
 * duplicated by accident. */
export type NoQrVenueRefDTO = VenueRefDTO;

/** Mirrors `PublicNoQrPlaceOut` (api/app/api/schemas.py) — No QR
 * Independent Entity. Exactly one of `name`/`venue` is ever non-null:
 * `venue` set means this place links an existing Venue (by reference,
 * never duplicated); `name` set means it's a standalone place with no
 * Venue record at all. */
export interface NoQrPlaceDTO {
  id: number;
  name: string | null;
  venue: NoQrVenueRefDTO | null;
}

/** Mirrors `PublicNoQrAreaOut` (api/app/api/schemas.py) —
 * `GET /public/discover/no-qr-areas`. `type` is the authoritative Walk/
 * Mall classification; never re-derive it from a place's venue category
 * or tags. */
export interface NoQrAreaDTO {
  id: number;
  name: string;
  type: "Walk" | "Mall";
  places: NoQrPlaceDTO[];
}
