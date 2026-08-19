import type { PublishedVenueDTO } from "@/lib/api/dto";
import type { Venue } from "@/lib/domain/venue";
import { toVenueCategory } from "@/lib/domain/categories";
import {
  toValidInstagramUrl,
  toValidPhone,
  toValidUrl,
  toValidWhatsapp,
} from "@/lib/domain/validators";
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

/** Booking CTA Fields (Phase 2) — same category/tag mapping as Studio's
 * `BookingSection.tsx` (`resolveBookingField`), translated to Consumer's
 * already-bucketed `VenueCategory` instead of Studio's raw strings: `"beach"`
 * only ever comes from Studio's `"Beach Club"`, `"nightlife"` only from
 * `"Nightlife"`, and `"food"` only from `"Restaurant"` (`"Cafe"` maps to the
 * separate `"coffee"` bucket — see `RAW_CATEGORY_MAP` in
 * `lib/domain/categories.ts`), so checking the domain category here is
 * equivalent to Studio's raw-string check, not an approximation of it.
 * Exactly one of the three ever applies, matching the backend's own "at most
 * one populated field" invariant — returns `null` the moment none match or
 * the matching field's URL is empty/invalid. */
function resolveBookingCta(
  category: Venue["category"],
  tags: string[],
  dto: PublishedVenueDTO,
): Venue["booking"] {
  if (category === "beach") {
    const url = toValidUrl(dto.reserve_your_spot_beach_url);
    return url ? { label: "Reserve Your Spot", url } : null;
  }
  if (category === "nightlife") {
    const url = toValidUrl(dto.reserve_your_spot_nightlife_url);
    return url ? { label: "Reserve Your Spot", url } : null;
  }
  if (category === "food" && tags.includes("fine-dining")) {
    const url = toValidUrl(dto.reserve_your_table_url);
    return url ? { label: "Reserve Your Table", url } : null;
  }
  return null;
}

/** DTO -> Domain. The one place a gap in API_REQUIREMENTS.md becomes a `null`
 * or `[]` on the domain model — every field below traces to a numbered
 * requirement there, and filling that requirement means editing only this
 * function, never a component. */
export function toVenue(dto: PublishedVenueDTO): Venue {
  const openingHours = toOpeningHours(dto.opening_hours);
  const category = toVenueCategory(dto.category);

  return {
    id: dto.id,
    slug: dto.slug,
    name: dto.name,
    destinationId: dto.destination.id,
    destinationName: dto.destination.name,
    district: dto.district,
    category,
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
      instagram: toValidInstagramUrl(dto.instagram_handle),
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

    // API_REQUIREMENTS.md §8 — `priceRange`/`amenities`/`highlights` still
    // have no source on `PublishedVenueOut`; `tags`/`access_type`/
    // `reservation_policy` do, as of commit e71880c (Phase 1 taxonomy) —
    // mapped below instead of hardcoded.
    priceRange: null,
    amenities: [],
    highlights: [],

    tags: dto.tags,
    accessType: dto.access_type,
    reservationPolicy: dto.reservation_policy,

    booking: resolveBookingCta(category, dto.tags, dto),
  };
}
