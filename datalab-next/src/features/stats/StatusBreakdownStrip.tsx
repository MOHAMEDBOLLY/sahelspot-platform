import { CheckCircle2, Eye, FileEdit, Layers } from 'lucide-react'
import { DashboardCard } from '../../components/DashboardCard'
import type { StatusBreakdown } from '../../lib/dashboardAggregates'
import type { VenueStatus } from '../../types/venue'

type StatusBreakdownStripProps = {
  breakdown: StatusBreakdown
  /** When provided, Draft/Review/Approved become clickable (Phase 2
   * Quality Center drill-down to `/venues?status=<value>`, an existing,
   * already-supported filter). "Total Venues" never links — there's no
   * `status=` value meaning "all". Omitted on the Dashboard, which stays
   * display-only per its original Phase 1 scope. */
  onStatusClick?: (status: VenueStatus) => void
}

/** Display-only by default (the Dashboard's original Phase 1 usage); pass
 * `onStatusClick` to make the status tiles clickable (Quality Center) —
 * same component, two callers, no fork. */
export function StatusBreakdownStrip({ breakdown, onStatusClick }: StatusBreakdownStripProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <DashboardCard icon={Layers} label="Total Venues" value={String(breakdown.total)} />
      <DashboardCard
        icon={FileEdit}
        label="Draft"
        value={String(breakdown.counts.draft)}
        onClick={onStatusClick ? () => onStatusClick('draft') : undefined}
      />
      <DashboardCard
        icon={Eye}
        label="Review"
        value={String(breakdown.counts.review)}
        onClick={onStatusClick ? () => onStatusClick('review') : undefined}
      />
      <DashboardCard
        icon={CheckCircle2}
        label="Approved"
        value={String(breakdown.counts.approved)}
        onClick={onStatusClick ? () => onStatusClick('approved') : undefined}
      />
    </div>
  )
}
