/** Shared by every edit-mode input control — keeps the base input styling in
 * one place instead of repeated per field type. `min-h-11` gives every
 * input a 44px touch target below `lg:`; `lg:min-h-0` restores the exact
 * pre-sprint box (content + `py-1.5` only) at desktop — one edit here
 * fixes every text/select/textarea field at once, since they all read
 * from this module. */
export const FIELD_INPUT_CLASSNAME =
  'min-h-11 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none lg:min-h-0'

/** Same base styling, switched to a red border when the field has a
 * (frontend UX-level) validation error. */
export function fieldInputClassName(hasError: boolean): string {
  return hasError
    ? 'min-h-11 rounded-lg border border-red-400 px-3 py-1.5 text-sm text-gray-900 focus:border-red-500 focus:outline-none lg:min-h-0'
    : FIELD_INPUT_CLASSNAME
}
