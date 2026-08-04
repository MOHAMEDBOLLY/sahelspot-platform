import type { PublishedVenueDTO } from "@/lib/api/dto";
import type { Venue } from "@/lib/domain/venue";
import { toVenueCategory } from "@/lib/domain/categories";
import { toValidPhone, toValidUrl, toValidWhatsapp } from "@/lib/domain/validators";
import { isOpenAt, toOpeningHours } from "@/lib/domain/openingHours";

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
  const openingHours = toOpeningHours(dto.opening_hours);

  return {
    id: dto.id,
    slug: dto.slug,
    name: dto.name,
    destinationId: dto.destination.id,
    destinationName: dto.destination.name,
    district: dto.district,
    category: toVenueCategory(dto.category),
    isFeatured: dto.is_featured,
    isVerified: dto.is_verified,
    coordinates: toCoordinates(dto.latitude, dto.longitude),
    coverImageUrl: dto.cover_image_url,
    galleryImageUrls: dto.gallery_image_urls ?? [],
    shortDescription: dto.short_description,
    // Validated here, not at render time: a malformed phone/URL becomes
    // null exactly like an absent one, so IconActionButton/CTAButton's
    // existing "omit if null" behaviour is what keeps a garbage value off
    // the screen, without every component re-implementing validation.
    contact: {
      phone: toValidPhone(dto.phone),
      whatsapp: toValidWhatsapp(dto.whatsapp),
      website: toValidUrl(dto.website),
      mapsUrl: toValidUrl(dto.maps_url),
    },

    // API_REQUIREMENTS.md §1 — ratings have no source yet.
    rating: null,
    reviewCount: null,

    // §7 — shape confirmed against real data (docs/consumer/lib/domain/openingHours.ts).
    // `isOpenNow` is computed once, at fetch time, against the moment the
    // query ran — an accepted simplification given TanStack's 5-minute
    // staleTime already means "now" is only ever approximate here, and today
    // only 1/401 venues have hours data at all.
    openingHours,
    isOpenNow: openingHours ? isOpenAt(openingHours, new Date()) : null,

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
