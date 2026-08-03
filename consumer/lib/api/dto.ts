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
}

export interface PublishedDestinationDTO {
  id: string;
  name: string;
  region: string;
  aliases: string[] | null;
  boundary: Record<string, unknown> | null;
}

export interface VenueRefDTO {
  id: string;
  name: string;
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
