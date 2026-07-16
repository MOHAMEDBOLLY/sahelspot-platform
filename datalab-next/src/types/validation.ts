/** Mirrors the backend's generic validation response shape
 * (api/app/validation/schemas.py) — the same contract for every entity's
 * canonical Validate endpoint, not just venues. */
export interface FieldError {
  field: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: FieldError[]
}
