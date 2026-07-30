import type { VenueQuality } from './venueQuality'
import { TRACKED_QUALITY_FIELDS, type QualityField } from './qualityFieldRegistry'

/** Fields that count as "digital presence" — a venue findable/contactable
 * outside the platform. Shared by Advanced Filters (`digitalPresence=
 * any|none`) and `dashboardAggregates.ts`'s Action Queue ("No Digital
 * Presence" group) — one definition, not two independently-maintained
 * copies of the same three fields. */
export const DIGITAL_PRESENCE_FIELDS: QualityField[] = ['instagram', 'website', 'phone']

export function hasAnyDigitalPresence(quality: VenueQuality): boolean {
  return DIGITAL_PRESENCE_FIELDS.some((field) => !quality.missingFields.includes(field))
}

export function hasNoDigitalPresence(quality: VenueQuality): boolean {
  return DIGITAL_PRESENCE_FIELDS.every((field) => quality.missingFields.includes(field))
}

/** The quality-based filter dimensions the Venue List can express — all
 * purely client-side, since `GET /editor/venues` has no equivalent query
 * params. Five orthogonal primitives (not one param per named preset —
 * "Nearly Complete", "Complete Only", "Has Any Digital Presence" etc. are
 * all just particular values of these, translated at the UI layer, not
 * separate predicates). See `pages/Venues.tsx` for the URL param names
 * these map to (`has`, `missing`, `minCompletion`, `maxCompletion`,
 * `missingCount`, `digitalPresence`). */
export interface QualityFilterParams {
  /** Venue must have every field listed (AND). */
  has?: QualityField[]
  /** Venue must be missing every field listed (AND). */
  missing?: QualityField[]
  /** `completionPercent >= minCompletion`. */
  minCompletion?: number
  /** `completionPercent < maxCompletion` — unchanged from Sprint 1; kept
   * strict-less-than so existing links (`maxCompletion=100` for "Needs
   * Attention", `maxCompletion=34` for "Low Completion") keep meaning
   * exactly what they meant before this sprint. */
  maxCompletion?: number
  /** Exact count of missing fields (e.g. `1` = "Nearly Complete"). */
  missingCount?: number
  digitalPresence?: 'any' | 'none'
}

export function hasQualityFilter(params: QualityFilterParams): boolean {
  return (
    (params.has?.length ?? 0) > 0 ||
    (params.missing?.length ?? 0) > 0 ||
    params.minCompletion !== undefined ||
    params.maxCompletion !== undefined ||
    params.missingCount !== undefined ||
    params.digitalPresence !== undefined
  )
}

/** Reads only `VenueQuality` fields already produced by
 * `evaluateVenueQuality` — no new evaluation, no re-derivation of
 * presence/completion. All set dimensions combine with AND semantics
 * (e.g. `has=cover` + `maxCompletion=50` narrows to both at once). */
export function matchesQualityFilter(quality: VenueQuality, params: QualityFilterParams): boolean {
  if (params.has?.length && !params.has.every((field) => !quality.missingFields.includes(field))) {
    return false
  }
  if (params.missing?.length && !params.missing.every((field) => quality.missingFields.includes(field))) {
    return false
  }
  if (params.minCompletion !== undefined && quality.completionPercent < params.minCompletion) {
    return false
  }
  if (params.maxCompletion !== undefined && quality.completionPercent >= params.maxCompletion) {
    return false
  }
  if (params.missingCount !== undefined && quality.missingFields.length !== params.missingCount) {
    return false
  }
  if (params.digitalPresence === 'any' && !hasAnyDigitalPresence(quality)) {
    return false
  }
  if (params.digitalPresence === 'none' && !hasNoDigitalPresence(quality)) {
    return false
  }
  return true
}

const QUALITY_FILTER_URL_KEYS = [
  'has',
  'missing',
  'minCompletion',
  'maxCompletion',
  'missingCount',
  'digitalPresence',
] as const

/** The single place `QualityFilterParams` <-> URL query params are
 * converted, in both directions — used by `pages/Venues.tsx` (parsing),
 * `features/quality/ActionQueueList.tsx` (building exact drill-down
 * links from `computeActionQueue`'s `filterParams`), and Saved Views
 * (persisting/restoring the params a view represents). No other module
 * hand-rolls this conversion. */
export function serializeQualityFilterParams(params: QualityFilterParams): Record<string, string> {
  const result: Record<string, string> = {}
  if (params.has?.length) result.has = params.has.join(',')
  if (params.missing?.length) result.missing = params.missing.join(',')
  if (params.minCompletion !== undefined) result.minCompletion = String(params.minCompletion)
  if (params.maxCompletion !== undefined) result.maxCompletion = String(params.maxCompletion)
  if (params.missingCount !== undefined) result.missingCount = String(params.missingCount)
  if (params.digitalPresence !== undefined) result.digitalPresence = params.digitalPresence
  return result
}

function parseFieldList(raw: string): QualityField[] {
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter((value): value is QualityField => TRACKED_QUALITY_FIELDS.includes(value as QualityField))
}

export function parseQualityFilterParams(searchParams: URLSearchParams): QualityFilterParams {
  const params: QualityFilterParams = {}

  const has = searchParams.get('has')
  if (has) {
    const fields = parseFieldList(has)
    if (fields.length > 0) params.has = fields
  }

  const missing = searchParams.get('missing')
  if (missing) {
    const fields = parseFieldList(missing)
    if (fields.length > 0) params.missing = fields
  }

  const minCompletion = searchParams.get('minCompletion')
  if (minCompletion !== null && !Number.isNaN(Number(minCompletion))) {
    params.minCompletion = Number(minCompletion)
  }

  const maxCompletion = searchParams.get('maxCompletion')
  if (maxCompletion !== null && !Number.isNaN(Number(maxCompletion))) {
    params.maxCompletion = Number(maxCompletion)
  }

  const missingCount = searchParams.get('missingCount')
  if (missingCount !== null && !Number.isNaN(Number(missingCount))) {
    params.missingCount = Number(missingCount)
  }

  const digitalPresence = searchParams.get('digitalPresence')
  if (digitalPresence === 'any' || digitalPresence === 'none') {
    params.digitalPresence = digitalPresence
  }

  return params
}

/** Every URL key `QualityFilterParams` occupies — used to clear all of
 * them at once (Venues.tsx's "Clear quality filter") without hand-listing
 * the keys a second time. */
export function qualityFilterUrlKeys(): readonly string[] {
  return QUALITY_FILTER_URL_KEYS
}
