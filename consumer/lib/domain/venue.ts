import type { OpeningHours } from "./openingHours";
import type { VenueCategory } from "./categories";

export type { VenueCategory } from "./categories";

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
    /** Venue Details action row — surfaces `PublishedVenueDTO.instagram_handle`
     * (already on the wire) as a full profile URL. Not previously mapped:
     * the DTO field existed, nothing read it. Full URL, not a bare handle,
     * so this behaves exactly like `website` at every call site — one
     * `href`, no component re-deriving the link shape. */
    instagram: string | null;
  };

  /** API_REQUIREMENTS.md §1 — no source yet. */
  rating: number | null;
  reviewCount: number | null;

  /** §7 — real shape confirmed against publish revision 1071, though only
   * 1/401 venues currently have it populated. `null` covers both "absent"
   * and "present but malformed" (see `toOpeningHours`). */
  openingHours: OpeningHours | null;
  /** Derived from `openingHours` at fetch time — see `toVenue`'s comment on
   * why that's an acceptable simplification here. */
  isOpenNow: boolean | null;

  /** API_REQUIREMENTS.md §8 — no source yet. */
  distanceLabel: string | null;
  priceRange: string | null;
  amenities: string[];
  highlights: string[];

  /** Category/Tags/Access Type/Badges/Collections architecture (Phase 1) —
   * sourced from `PublishedVenueOut.tags`/`.access_type`/`.reservation_policy`
   * since commit e71880c. `tags` are raw Studio slugs (e.g.
   * `"specialty-coffee"`), rendered as-is — there's no public label catalog
   * to translate them through (`GET /editor/tags` is auth-gated), matching
   * how `category`'s own raw Studio strings are the only vocabulary
   * `/public/search/venues` accepts. `accessType`/`reservationPolicy` are
   * `null` for the common "no restriction" case, exactly like every other
   * optional field on this type. */
  tags: string[];
  accessType: string | null;
  reservationPolicy: string | null;

  /** Booking CTA Fields (Phase 2) — resolved from
   * `reserve_your_spot_beach_url`/`reserve_your_table_url`/
   * `reserve_your_spot_nightlife_url` by `resolveBookingCta` in
   * `mappers/venue.ts`. At most one ever applies to a given venue (Beach
   * Club, Nightlife, or Restaurant+`fine-dining`), mirroring Studio's own
   * `BookingSection.tsx` — so this is a single resolved CTA, not three raw
   * URL fields, exactly like `contact.mapsUrl` is one resolved field rather
   * than every possible source of a maps link. `null` means either no
   * matching category/tag or an unset/invalid URL. */
  booking: { label: "Reserve Your Spot" | "Reserve Your Table"; url: string } | null;
};
