import { isRequired, isWithinMaxLength, runFieldRules } from '../../lib/validation'
import type { FieldErrors } from '../../lib/validation'
import type { Destination } from '../../types/destination'

const NOTES_MAX_LENGTH = 2000

/**
 * Immediate UX feedback only — same reasoning as venues' `venueValidation.ts`.
 * No Editorial Readiness endpoint exists for destinations yet (no
 * `POST /destinations/{id}/validate` this sprint), so this is currently the
 * *only* validation a destination draft gets — a generic required-ness/
 * length check, not a business rule. When a canonical `validate_destination()`
 * eventually exists, this file's job stays exactly what it is now: instant
 * typing feedback and gating Save Draft, never re-deciding a business rule
 * the backend owns.
 */
export function validateDestinationDraft(destination: Destination): FieldErrors {
  return runFieldRules(destination, {
    name: (value) => (isRequired(value) ? null : 'Name is required.'),
    region: (value) => (isRequired(value) ? null : 'Region is required.'),
    notes: (value) =>
      isWithinMaxLength(value, NOTES_MAX_LENGTH) ? null : `Must be ${NOTES_MAX_LENGTH} characters or fewer.`,
  })
}
