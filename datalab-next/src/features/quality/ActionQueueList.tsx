import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import type { ActionQueueGroup } from '../../lib/dashboardAggregates'
import { serializeQualityFilterParams } from '../../lib/venueQualityFilter'

type ActionQueueListProps = {
  groups: ActionQueueGroup[]
}

/** Highest-value work, one row per group — reads `ActionQueueGroup[]`
 * from `computeActionQueue`, which itself only reads already-computed
 * `VenueQuality` results. No categorization logic lives here.
 *
 * Phase 2 Sprint 2 — every group's drill-down link is now exact: each
 * group carries the same `filterParams` used to compute its membership,
 * serialized via `serializeQualityFilterParams` (the one place
 * `QualityFilterParams` becomes URL params). Sprint 1's approximate
 * "(via filter)" links are gone — Advanced Filters' `missing=a,b` and
 * `digitalPresence=none`/`missingCount=` params can express every group
 * precisely now. */
export function ActionQueueList({ groups }: ActionQueueListProps) {
  return (
    <div className="flex flex-col divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
      {groups.map((group) => {
        const query = new URLSearchParams(serializeQualityFilterParams(group.filterParams)).toString()
        return (
          <div key={group.key} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900">{group.label}</p>
              <p className="text-xs text-gray-500">{group.description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-sm font-semibold tabular-nums text-gray-900">{group.count}</span>
              {group.count > 0 && (
                <Link
                  to={`/venues?${query}`}
                  className="flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gray-900"
                  aria-label={`View venues for ${group.label}`}
                >
                  View
                  <ArrowRight size={12} />
                </Link>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
