/**
 * Mirrors the fixed role list enforced by the API's CHECK constraint
 * (api/app/db/models.py APP_USER_ROLES) — same reasoning as
 * `venues/venueCategories.ts`'s `VENUE_CATEGORIES`.
 */
export const APP_USER_ROLES = ['viewer', 'editor', 'publisher', 'admin'] as const
