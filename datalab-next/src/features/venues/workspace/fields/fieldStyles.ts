/** Shared by every edit-mode input control — keeps the base input styling in
 * one place instead of repeated per field type. */
export const FIELD_INPUT_CLASSNAME =
  'rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none'

/** Same base styling, switched to a red border when the field has a
 * (frontend UX-level) validation error — see venueValidation.ts. */
export function fieldInputClassName(hasError: boolean): string {
  return hasError
    ? 'rounded-lg border border-red-400 px-3 py-1.5 text-sm text-gray-900 focus:border-red-500 focus:outline-none'
    : FIELD_INPUT_CLASSNAME
}
