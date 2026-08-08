/** Access Type / Reservation Policy — the other half of the Category/Tags/
 * Access Type/Badges/Collections architecture (Phase 1), alongside
 * `lib/domain/categories.ts`'s venue-category taxonomy.
 *
 * Both vocabularies below are small, fixed, closed sets defined on the
 * backend (`ACCESS_TYPES`/`RESERVATION_POLICIES`, api/app/db/models.py) as
 * CHECK-constrained plain text — "Title Case, human-readable, no label-
 * mapping layer needed" per that file's own comment. Mirrored here rather
 * than fetched, the same reasoning `categories.ts` already gives for its
 * own hardcoded `CATEGORIES` list: no public endpoint serves this
 * vocabulary (only `GET /editor/tags`-style catalogs are auth-gated), so a
 * runtime-fetched version isn't an option without inventing an API
 * contract that doesn't exist. */

export const ACCESS_TYPES = [
  "Public",
  "Paid Entry",
  "QR Required",
  "Residents Only",
  "Hotel Guests Only",
] as const;

export type AccessType = (typeof ACCESS_TYPES)[number];

/** Material Symbols Outlined glyph per Access Type — used by the Search
 * filter row and Venue Details' info pill. */
export const ACCESS_TYPE_ICON: Record<AccessType, string> = {
  Public: "public",
  "Paid Entry": "payments",
  "QR Required": "qr_code_scanner",
  "Residents Only": "home",
  "Hotel Guests Only": "hotel",
};

export const RESERVATION_POLICIES = ["Required", "Recommended"] as const;

export type ReservationPolicy = (typeof RESERVATION_POLICIES)[number];
