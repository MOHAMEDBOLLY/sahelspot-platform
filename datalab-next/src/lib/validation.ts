/**
 * Generic, entity-agnostic UX validation helpers — required-ness, length,
 * and format checks a user can react to instantly while typing. This is
 * deliberately shallow: it has no opinion about what counts as a *valid
 * venue* (or destination, or anything else) — that's business logic, and
 * business logic lives on the backend only (see api/app/validation/). This
 * module exists so every entity's edit form can share the same handful of
 * generic rule primitives instead of re-implementing "is this a URL?" per
 * feature.
 */

export type FieldErrors = Record<string, string>
export type FieldValidator<T> = (value: T) => string | null

export function isRequired(value: string | null | undefined): boolean {
  return value != null && value.trim() !== ''
}

export function isWithinMaxLength(value: string | null | undefined, max: number): boolean {
  return (value?.length ?? 0) <= max
}

export function isValidUrl(value: string | null | undefined): boolean {
  if (!value) return true
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

export function isValidDecimal(value: string | null | undefined): boolean {
  if (!value) return true
  return /^-?\d+(\.\d+)?$/.test(value.trim())
}

/** Runs one validator per named field and collects only the failures. */
export function runFieldRules<T extends object>(
  value: T,
  rules: { [K in keyof T]?: FieldValidator<T[K]> },
): FieldErrors {
  const errors: FieldErrors = {}
  for (const key of Object.keys(rules) as (keyof T)[]) {
    const rule = rules[key]
    if (!rule) continue
    const message = rule(value[key])
    if (message) {
      errors[key as string] = message
    }
  }
  return errors
}
