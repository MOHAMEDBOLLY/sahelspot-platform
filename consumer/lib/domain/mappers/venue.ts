import type { PublishedVenueDTO } from "@/lib/api/dto";
import type { Venue, VenueCategory } from "@/lib/domain/venue";

const KNOWN_CATEGORIES: readonly VenueCategory[] = [
  "beach",
  "food",
  "coffee",
  "nightlife",
  "general",
];

/** The wire `category` is a free-text string; the UI needs the closed union
 * that drives map marker colour and category icon. An unrecognized value
 * (a new Studio category the client hasn't been taught about yet) degrades to
 * `"general"` rather than throwing — a marker in the wrong-but-valid colour
 * is a much smaller failure than one venue disappearing from the whole app. */
function toVenueCategory(raw: string): VenueCategory {
  const normalized = raw.trim().toLowerCase();
  return (KNOWN_CATEGORIES as readonly string[]).includes(normalized)
    ? (normalized as VenueCategory)
    : "general";
}

/** `latitude`/`longitude` are `str | None` on the wire. A present-but-
 * unparseable value is treated the same as absent — excluded from the map
 * rather than plotted at 0,0 — since a bad string is closer to "no
 * coordinates" than to a real location. */
function toCoordinates(
  latitude: string | null,
  longitude: string | null,
): Venue["coordinates"] {
  if (latitude === null || longitude === null) return null;
  const lat = Number.parseFloat(latitude);
  const lng = Number.parseFloat(longitude);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
}

/** DTO -> Domain. The one place a gap in API_REQUIREMENTS.md becomes a `null`
 * or `[]` on the domain model — every field below traces to a numbered
 * requirement there, and filling that requirement means editing only this
 * function, never a component. */
export function toVenue(dto: PublishedVenueDTO): Venue {
  return {
    id: dto.id,
    slug: dto.slug,
    name: dto.name,
    destinationName: dto.destination.name,
    district: dto.district,
    category: toVenueCategory(dto.category),
    isFeatured: dto.is_featured,
    isVerified: dto.is_verified,
    coordinates: toCoordinates(dto.latitude, dto.longitude),
    coverImageUrl: dto.cover_image_url,
    galleryImageUrls: dto.gallery_image_urls ?? [],
    shortDescription: dto.short_description,
    contact: {
      phone: dto.phone,
      whatsapp: dto.whatsapp,
      website: dto.website,
      mapsUrl: dto.maps_url,
    },

    // API_REQUIREMENTS.md §1 — ratings have no source yet.
    rating: null,
    reviewCount: null,

    // API_REQUIREMENTS.md §7 — opening_hours shape isn't agreed with Studio
    // yet, so "open now" can't be derived even though the field exists.
    isOpenNow: null,

    // API_REQUIREMENTS.md §4 — needs either the nearby endpoint or client
    // geolocation, neither wired yet.
    distanceLabel: null,

    // API_REQUIREMENTS.md §8 — none of these exist on PublishedVenueOut yet.
    priceRange: null,
    tags: [],
    amenities: [],
    highlights: [],
  };
}
