import { isRequired, isValidDecimal, isValidUrl, isWithinMaxLength, runFieldRules } from '../../lib/validation'
import type { FieldErrors } from '../../lib/validation'
import type { Venue } from '../../types/venue'

const SHORT_DESCRIPTION_MAX_LENGTH = 500
const INTERNAL_NOTES_MAX_LENGTH = 2000

/**
 * Immediate UX feedback only — required-ness, length, and format. This is
 * not the canonical "is this venue valid" answer (that's the backend's
 * `POST /venues/{id}/validate`, see api/app/validation/venues.py) — it's
 * just enough for Save Draft to catch obvious problems before a round trip.
 * Deliberately excludes anything that's a business rule rather than a
 * generic format check (category membership, geographic coordinate bounds)
 * so there's exactly one place those rules live.
 */
export function validateVenueDraft(venue: Venue): FieldErrors {
  return runFieldRules(venue, {
    name: (value) => (isRequired(value) ? null : 'Name is required.'),
    short_description: (value) =>
      isWithinMaxLength(value, SHORT_DESCRIPTION_MAX_LENGTH)
        ? null
        : `Must be ${SHORT_DESCRIPTION_MAX_LENGTH} characters or fewer.`,
    internal_notes: (value) =>
      isWithinMaxLength(value, INTERNAL_NOTES_MAX_LENGTH)
        ? null
        : `Must be ${INTERNAL_NOTES_MAX_LENGTH} characters or fewer.`,
    website: (value) => (isValidUrl(value) ? null : 'Must be a valid URL.'),
    maps_url: (value) => (isValidUrl(value) ? null : 'Must be a valid URL.'),
    latitude: (value) => (isValidDecimal(value) ? null : 'Must be a number.'),
    longitude: (value) => (isValidDecimal(value) ? null : 'Must be a number.'),
  })
}
