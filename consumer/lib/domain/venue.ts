/** The UI-facing venue shape — docs/consumer/ARCHITECTURE.md §3.
 *
 * Deliberately not `PublishedVenue`: components never see snake_case, a
 * stringified coordinate, or a null list. The mapper (added in Phase 3 with
 * the rest of the data layer) is the one place that translates between them,
 * so filling an API gap from docs/consumer/API_REQUIREMENTS.md only ever
 * touches that one function.
 *
 * Every field below that has no source in `PublishedVenueOut` today is
 * marked with the requirement it corresponds to and is `| null` — every
 * component that uses it must render correctly without it. */
export type VenueCategory = "beach" | "food" | "coffee" | "nightlife" | "general";

export type Venue = {
  id: string;
  slug: string;
  name: string;
  destinationId: string;
  destinationName: string;
  district: string | null;
  category: VenueCategory;
  isFeatured: boolean;
  isVerified: boolean;
  coordinates: { lat: number; lng: number } | null;
  coverImageUrl: string | null;
  galleryImageUrls: string[];
  shortDescription: string | null;
  contact: {
    phone: string | null;
    whatsapp: string | null;
    website: string | null;
    mapsUrl: string | null;
  };

  /** API_REQUIREMENTS.md §1 — no source yet. */
  rating: number | null;
  reviewCount: number | null;

  /** API_REQUIREMENTS.md §7/§8 — no source yet. */
  isOpenNow: boolean | null;
  distanceLabel: string | null;
  priceRange: string | null;
  tags: string[];
  amenities: string[];
  highlights: string[];
};
