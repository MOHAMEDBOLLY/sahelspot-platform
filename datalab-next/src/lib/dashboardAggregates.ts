import type { Venue, VenueStatus } from '../types/venue'
import type { Destination } from '../types/destination'
import { evaluateVenueQuality, type VenueQuality } from './venueQuality'
import { TRACKED_QUALITY_FIELDS, type QualityField } from './qualityFieldRegistry'
import { matchesQualityFilter, type QualityFilterParams } from './venueQualityFilter'

const TRACKED_STATUSES: VenueStatus[] = ['draft', 'review', 'approved', 'archived']

/** Evaluates every venue's quality exactly once, keyed by venue id.
 * Every aggregate function below that needs quality takes this map
 * rather than raw venues + re-evaluating internally — `evaluateVenueQuality`
 * runs once per venue, total, no matter how many aggregates consume the
 * result. */
export function evaluateVenueQualities(venues: Venue[]): Map<string, VenueQuality> {
  const map = new Map<string, VenueQuality>()
  for (const venue of venues) {
    map.set(venue.id, evaluateVenueQuality(venue))
  }
  return map
}

export interface StatusBreakdown {
  total: number
  counts: Record<VenueStatus, number>
}

/** Counts venues per workflow status — pure tally, no evaluator involved
 * (status isn't a quality dimension). */
export function computeStatusBreakdown(venues: Venue[]): StatusBreakdown {
  const counts = Object.fromEntries(TRACKED_STATUSES.map((status) => [status, 0])) as Record<
    VenueStatus,
    number
  >
  for (const venue of venues) {
    counts[venue.status] += 1
  }
  return { total: venues.length, counts }
}

export type MissingDataCounts = Record<QualityField, number>

/** How many venues are missing each tracked field — reads pre-computed
 * quality results (see `evaluateVenueQualities`), never evaluates a venue
 * itself. */
export function computeMissingDataCounts(qualityByVenueId: ReadonlyMap<string, VenueQuality>): MissingDataCounts {
  const counts = Object.fromEntries(TRACKED_QUALITY_FIELDS.map((field) => [field, 0])) as MissingDataCounts
  for (const quality of qualityByVenueId.values()) {
    for (const field of quality.missingFields) {
      counts[field] += 1
    }
  }
  return counts
}

export interface DestinationProgress {
  destinationId: string
  destinationName: string
  venueCount: number
  /** Venues whose quality evaluates to 100% complete. */
  readyCount: number
  /** Average `completionPercent` across the destination's venues, rounded.
   * `0` (not `NaN`) for a destination with zero venues. */
  averageCompletionPercent: number
}

/** One row per destination, ordered the same as the input `destinations`
 * array (callers control ordering, e.g. alphabetical from the API). Reads
 * pre-computed quality results — never evaluates a venue itself. */
export function computeDestinationProgress(
  venues: Venue[],
  destinations: Destination[],
  qualityByVenueId: ReadonlyMap<string, VenueQuality>,
): DestinationProgress[] {
  const venuesByDestination = new Map<string, Venue[]>()
  for (const venue of venues) {
    const list = venuesByDestination.get(venue.destination.id)
    if (list) {
      list.push(venue)
    } else {
      venuesByDestination.set(venue.destination.id, [venue])
    }
  }

  return destinations.map((destination) => {
    const destinationVenues = venuesByDestination.get(destination.id) ?? []
    const qualities = destinationVenues
      .map((venue) => qualityByVenueId.get(venue.id))
      .filter((quality): quality is VenueQuality => quality !== undefined)
    const readyCount = qualities.filter((q) => q.completionPercent === 100).length
    const averageCompletionPercent =
      qualities.length === 0
        ? 0
        : Math.round(qualities.reduce((sum, q) => sum + q.completionPercent, 0) / qualities.length)

    return {
      destinationId: destination.id,
      destinationName: destination.name,
      venueCount: destinationVenues.length,
      readyCount,
      averageCompletionPercent,
    }
  })
}

/** The single top-line number: average per-venue completion across the
 * whole dataset. `0` for an empty dataset, never `NaN`. Reads pre-computed
 * quality results — never evaluates a venue itself. */
export function computeOverallCompletion(qualityByVenueId: ReadonlyMap<string, VenueQuality>): number {
  if (qualityByVenueId.size === 0) return 0
  let total = 0
  for (const quality of qualityByVenueId.values()) {
    total += quality.completionPercent
  }
  return Math.round(total / qualityByVenueId.size)
}

export interface CompletionSummary {
  complete: number
  needsAttention: number
}

/** `complete` = fully at 100%; `needsAttention` = everything else (no
 * invented threshold — "needs attention" is simply "not yet complete").
 * Reads pre-computed quality results only. */
export function computeCompletionSummary(qualityByVenueId: ReadonlyMap<string, VenueQuality>): CompletionSummary {
  let complete = 0
  for (const quality of qualityByVenueId.values()) {
    if (quality.completionPercent === 100) complete += 1
  }
  return { complete, needsAttention: qualityByVenueId.size - complete }
}

export interface CompletionBucket {
  /** Raw field-presence score this bucket represents (0..N, N = number of
   * tracked fields) — today's evaluator only produces N+1 discrete scores,
   * so bucketing by score (not by an arbitrary percent range) is the only
   * grouping that reflects the actual data. If the quality model ever
   * grows more granular (weighted fields, more tracked attributes), this
   * shape is the one to replace with percent-range buckets — nothing
   * downstream should need to change beyond swapping this function's body
   * and how a caller labels each bucket. */
  score: number
  /** The `completionPercent` value every venue in this bucket shares. */
  percent: number
  count: number
  /** Rounded 0-100, `0` for an empty dataset. */
  percentageOfDataset: number
}

/** One bucket per attainable score, ordered highest (100%) to lowest
 * (0%). Reads pre-computed quality results only. */
export function computeCompletionDistribution(
  qualityByVenueId: ReadonlyMap<string, VenueQuality>,
): CompletionBucket[] {
  const maxScore = TRACKED_QUALITY_FIELDS.length
  const countsByScore = new Map<number, number>()
  for (let score = 0; score <= maxScore; score += 1) {
    countsByScore.set(score, 0)
  }
  for (const quality of qualityByVenueId.values()) {
    countsByScore.set(quality.score, (countsByScore.get(quality.score) ?? 0) + 1)
  }

  const total = qualityByVenueId.size
  const buckets: CompletionBucket[] = []
  for (let score = maxScore; score >= 0; score -= 1) {
    const count = countsByScore.get(score) ?? 0
    buckets.push({
      score,
      percent: Math.round((score / maxScore) * 100),
      count,
      percentageOfDataset: total === 0 ? 0 : Math.round((count / total) * 100),
    })
  }
  return buckets
}

export type ActionQueueGroupKey = 'low_completion' | 'no_digital_presence' | 'missing_visuals' | 'nearly_complete'

export interface ActionQueueGroup {
  key: ActionQueueGroupKey
  label: string
  description: string
  venueIds: string[]
  count: number
  /** The exact `QualityFilterParams` that reproduce this group in the
   * Venue List — the same predicate used to build the group above, not a
   * separately-maintained approximation. Callers (e.g. `ActionQueueList`)
   * turn this into a URL via `venueSearchParamsToUrlParams`. */
  filterParams: QualityFilterParams
}

const LOW_COMPLETION_THRESHOLD = 34 // strictly-below-34 == 0%, 17%, or 33% at today's granularity

const ACTION_QUEUE_DEFINITIONS: Array<{
  key: ActionQueueGroupKey
  label: string
  description: string
  filterParams: QualityFilterParams
}> = [
  {
    key: 'low_completion',
    label: 'Low Completion',
    description: 'Completion below 34% — broadly incomplete records.',
    filterParams: { maxCompletion: LOW_COMPLETION_THRESHOLD },
  },
  {
    key: 'no_digital_presence',
    label: 'No Digital Presence',
    description: 'Missing Instagram, Website, and Phone — unreachable outside the platform.',
    filterParams: { digitalPresence: 'none' },
  },
  {
    key: 'missing_visuals',
    label: 'Missing Cover & Gallery',
    description: 'No images at all.',
    filterParams: { missing: ['cover', 'gallery'] },
  },
  {
    key: 'nearly_complete',
    label: 'Nearly Complete',
    description: 'Missing exactly one field — fastest wins available.',
    filterParams: { missingCount: 1 },
  },
]

/** Categorizes venues into the highest-value work groups. Each group's
 * membership is defined by a `QualityFilterParams` value and tested via
 * `matchesQualityFilter` — the same predicate engine Advanced Filters
 * uses — so there is exactly one implementation of "what does 'missing
 * cover and gallery' mean," not one for filtering and a second for this
 * summary. Ordered worst/highest-value first. A venue can appear in
 * multiple groups (e.g. a fully empty venue is both low-completion and
 * missing visuals). */
export function computeActionQueue(qualityByVenueId: ReadonlyMap<string, VenueQuality>): ActionQueueGroup[] {
  return ACTION_QUEUE_DEFINITIONS.map((definition) => {
    const venueIds: string[] = []
    for (const [venueId, quality] of qualityByVenueId) {
      if (matchesQualityFilter(quality, definition.filterParams)) {
        venueIds.push(venueId)
      }
    }
    return { ...definition, venueIds, count: venueIds.length }
  })
}
