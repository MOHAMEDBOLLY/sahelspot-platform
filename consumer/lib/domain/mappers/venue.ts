import type { PublishedVenueDTO } from "@/lib/api/dto";
import type { Venue, VenueCategory } from "@/lib/domain/venue";
import { toValidPhone, toValidUrl, toValidWhatsapp } from "@/lib/domain/validators";
import { isOpenAt, toOpeningHours } from "@/lib/domain/openingHours";

/** Real Studio category values, confirmed against publish revision 1071
 * (401 venues): `Restaurant` (156), `Cafe` (50), `Activity` (39), `Shopping`
 * (33), `Spa` (28), `Hotel` (26), `Services` (20), `Resort` (20),
 * `Beach Club` (19), `Nightlife` (8), `Other` (2).
 *
 * None of these match Stitch's five mood-grid categories literally except
 * `Nightlife` — the original `KNOWN_CATEGORIES` allowlist (checking for
 * `"beach"`/`"food"`/`"coffee"` verbatim) silently mapped 100% of real venues
 * outside Nightlife to `"general"`, including every restaurant and cafe. This
 * table is the actual translation Stitch's five-category design needs.
 *
 * `Activity`/`Shopping`/`Spa`/`Hotel`/`Services`/`Resort`/`Other` (168 venues,
 * 42% of the dataset) have no equivalent marker/icon in the Stitch design at
 * all — Stitch was designed around 5 categories, Studio's real taxonomy has
 * 11. These fall to `"general"` correctly, not as a bug: there is no
 * Stitch-designed treatment for "Spa" or "Hotel" to reproduce. Worth a
 * product conversation (does the mood grid/map need more categories?), not a
 * mapper fix. */
const CATEGORY_MAP: Record<string, VenueCategory> = {
  restaurant: "food",
  cafe: "coffee",
  "beach club": "beach",
  nightlife: "nightlife",
  // Accepted defensively in case Studio or seed data ever sends Stitch's own
  // category names directly.
  beach: "beach",
  food: "food",
  coffee: "coffee",
};

/** An unrecognized value (a new Studio category the client hasn't been
 * taught about yet) degrades to `"general"` rather than throwing — a marker
 * in the wrong-but-valid colour is a much smaller failure than one venue
 * disappearing from the whole app. */
function toVenueCategory(raw: string): VenueCategory {
  return CATEGORY_MAP[raw.trim().toLowerCase()] ?? "general";
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
