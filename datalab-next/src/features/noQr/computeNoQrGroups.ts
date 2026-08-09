import type { Venue } from '../../types/venue'

/** Studio Content Organization — "No QR" is an explicit designation
 * (`Venue.is_no_qr`), NOT derived from `access_type`. A normal Restaurant/
 * Coffee/Hotel venue that merely doesn't require a QR code to enter is not
 * a No QR discovery place by itself — that's a different concept, still
 * correctly served as-is by `GET /public/discover/no-qr`
 * (`api/app/api/routes/public.py`). See `Venue.is_no_qr`'s own docstring
 * (`api/app/db/models.py`) for the full reasoning. */
export function isNoQrVenue(venue: Venue): boolean {
  return venue.is_no_qr
}

export type NoQrGroups = {
  /** Designated No QR venues that at least one other venue points at via
   * `parent_venue_id` — "Zahra Walk", "Stella Walk", a mall, ... Per
   * product decision (and enforced by the backend), only an `is_no_qr`
   * venue can ever be a parent, so every key in `childrenByParentId`
   * below is one of these. */
  parents: Venue[]
  /** A parent's children, in name order. Children are ordinary venues
   * (`is_no_qr` is usually `false` here) — they're listed because they
   * point *at* a No QR place, not because they're one themselves. */
  childrenByParentId: Map<string, Venue[]>
  /** Designated No QR venues with no parent and no children — roadside/
   * independent places with no Walk/Mall context. */
  standalone: Venue[]
  /** STUDIO — BEACHES + NO QR FOUNDATION (migration 0019, prepared/not
   * applied) — `parents` split by `no_qr_type`. `unclassified` holds
   * parents where an editor hasn't set Walk or Mall yet — deliberately its
   * own bucket, not silently folded into either, since `no_qr_type` is
   * never inferred. Every parent venue appears in exactly one of these
   * three plus once in `parents` above (kept for backward compatibility
   * with any existing caller that doesn't care about the split). */
  parentsByType: {
    walks: Venue[]
    malls: Venue[]
    unclassified: Venue[]
  }
}

/** Pure grouping over an already-fetched venue list — no extra fetch, no
 * backend filter param. `venues` must be the *entire* venue set
 * (`useAllVenues`), not just `is_no_qr` ones: a Walk's children are
 * ordinary venues that wouldn't pass `isNoQrVenue` themselves, but still
 * need to be found and listed under their parent. */
export function computeNoQrGroups(venues: readonly Venue[]): NoQrGroups {
  const childrenByParentId = new Map<string, Venue[]>()
  for (const venue of venues) {
    if (!venue.parent_venue_id) continue
    const siblings = childrenByParentId.get(venue.parent_venue_id) ?? []
    siblings.push(venue)
    childrenByParentId.set(venue.parent_venue_id, siblings)
  }

  const parents: Venue[] = []
  const standalone: Venue[] = []
  for (const venue of venues.filter(isNoQrVenue)) {
    if (childrenByParentId.has(venue.id)) {
      parents.push(venue)
    } else if (!venue.parent_venue_id) {
      standalone.push(venue)
    }
  }

  const byName = (a: Venue, b: Venue) => a.name.localeCompare(b.name)
  parents.sort(byName)
  standalone.sort(byName)
  for (const siblings of childrenByParentId.values()) siblings.sort(byName)

  const parentsByType = {
    walks: parents.filter((v) => v.no_qr_type === 'Walk'),
    malls: parents.filter((v) => v.no_qr_type === 'Mall'),
    unclassified: parents.filter((v) => v.no_qr_type == null),
  }

  return { parents, childrenByParentId, standalone, parentsByType }
}
