/** Mirrors the backend's generic validation response shape
 * (api/app/validation/schemas.py) — the same contract for every entity's
 * canonical Validate endpoint, not just venues. */
export interface FieldError {
  field: string
  message: string
}

/** As of Sprint 13, this is an editorial readiness result, not just a
 * pass/fail check — `ready_for_review` is the concept Review will
 * eventually consume; `warnings`/`info` are additive extension points the
 * backend may populate later, currently always empty. */
export interface ValidationResult {
  valid: boolean
  ready_for_review: boolean
  errors: FieldError[]
  warnings: FieldError[]
  info: FieldError[]
}
