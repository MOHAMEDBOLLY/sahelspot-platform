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
