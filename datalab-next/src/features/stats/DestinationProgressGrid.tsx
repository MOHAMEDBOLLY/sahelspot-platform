import { Link } from 'react-router-dom'
import type { DestinationProgress } from '../../lib/dashboardAggregates'

type DestinationProgressGridProps = {
  rows: DestinationProgress[]
  /** When provided, each row becomes a link (Phase 2 Quality Center
   * drill-down to `/venues?destination=<id>`, an existing, already-
   * supported filter — no new filtering mechanism). Omitted on the
   * Dashboard, which stays display-only per its original Phase 1 scope. */
  linkTo?: (row: DestinationProgress) => string
}

/** Display-only by default (the Dashboard's original Phase 1 usage); pass
 * `linkTo` to make rows clickable (Quality Center) — same component,
 * two callers, no fork. */
export function DestinationProgressGrid({ rows, linkTo }: DestinationProgressGridProps) {
  if (rows.length === 0) return null

  return (
    <div className="flex flex-col divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
      {rows.map((row) => {
        const content = (
          <>
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-sm font-medium text-gray-900">{row.destinationName}</span>
              <span className="shrink-0 text-xs text-gray-500">
                {row.readyCount} ready / {row.venueCount} total
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${row.averageCompletionPercent}%` }}
              />
            </div>
          </>
        )

        if (!linkTo) {
          return (
            <div key={row.destinationId} className="flex flex-col gap-1.5 px-4 py-3">
              {content}
            </div>
          )
        }

        return (
          <Link
            key={row.destinationId}
            to={linkTo(row)}
            className="flex flex-col gap-1.5 px-4 py-3 text-left transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gray-900"
            aria-label={`View venues in ${row.destinationName} (${row.averageCompletionPercent}% average completion)`}
          >
            {content}
          </Link>
        )
      })}
    </div>
  )
}
