/** Mirrors `PublishedVenueOut`/`PublishedDestinationOut`
 * (api/app/api/schemas.py) — the `/public/*` response shapes. Only these
 * two exist yet; add more as later milestones need them. */

export interface DestinationRef {
  id: string;
  name: string;
}

export interface PublishedVenue {
  id: string;
  name: string;
  slug: string;
  destination: DestinationRef;
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

export interface PublishedDestination {
  id: string;
  name: string;
  region: string;
  aliases: string[] | null;
  boundary: Record<string, unknown> | null;
}
