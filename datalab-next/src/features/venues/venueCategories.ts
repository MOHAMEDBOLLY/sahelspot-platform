/**
 * Mirrors the fixed category list enforced by the API's CHECK constraint
 * (api/app/db/models.py VENUE_CATEGORIES). Not fetched from the API — it's a
 * small, closed, rarely-changing set, same reasoning as the backend's own
 * decision to keep it a constrained string rather than a lookup table.
 */
export const VENUE_CATEGORIES = [
  'Restaurant',
  'Cafe',
  'Hotel',
  'Beach',
  'Nightlife',
  'Shopping',
  'Services',
  'Entertainment',
  'Other',
  'Resort',
  'Spa',
  'Beach Club',
  'Activity',
] as const

/**
 * Category/Tags/Access Type/Badges/Collections architecture (Phase 1).
 * Mirrors the fixed set enforced by the API's CHECK constraint
 * (api/app/db/models.py ACCESS_TYPES/RESERVATION_POLICIES) — same "small,
 * fixed, closed set, not fetched from the API" reasoning VENUE_CATEGORIES
 * above already documents.
 */
export const ACCESS_TYPES = [
  'Public',
  'Paid Entry',
  'QR Required',
  'Residents Only',
  'Hotel Guests Only',
] as const

export const RESERVATION_POLICIES = ['Required', 'Recommended'] as const

/**
 * STUDIO — BEACHES + NO QR FOUNDATION (migration 0019, prepared/not
 * applied). Mirrors the fixed set enforced by the API's CHECK constraint
 * (api/app/db/models.py NO_QR_TYPES) — same "small, fixed, closed set, not
 * fetched from the API" reasoning as above.
 */
export const NO_QR_TYPES = ['Walk', 'Mall'] as const
