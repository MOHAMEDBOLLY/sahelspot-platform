import { DashboardCard } from '../../components/DashboardCard'
import type { MissingDataCounts } from '../../lib/dashboardAggregates'
import { QUALITY_FIELD_PRESENTATION } from '../../lib/qualityFieldPresentation'
import type { QualityField } from '../../lib/qualityFieldRegistry'

type MissingDataStripProps = {
  counts: MissingDataCounts
  /** When provided, each card's sublabel shows what percentage of the
   * dataset that count represents (e.g. "23% of venues"). Omit to keep
   * counts-only (the Dashboard's original Phase 1 behavior). */
  total?: number
  /** When provided, cards become clickable (Phase 2 Quality Center
   * drill-down). Omitted on the Dashboard, which stays display-only per
   * its original Phase 1 scope — see `DashboardCard`'s own `onClick` docs
   * for why that's a prop-presence check, not a separate component. */
  onFieldClick?: (field: QualityField) => void
}

/** Field order/label/icon come from `qualityFieldPresentation.ts` — no
 * locally-declared field metadata. Reused unchanged by the Dashboard
 * (counts-only, no `onFieldClick`) and the Quality Center (with `total`
 * and `onFieldClick`) — one component, two callers, no fork. */
export function MissingDataStrip({ counts, total, onFieldClick }: MissingDataStripProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {QUALITY_FIELD_PRESENTATION.map(({ id, label, icon }) => {
        const count = counts[id]
        const sublabel =
          total !== undefined && total > 0 ? `${Math.round((count / total) * 100)}% of venues` : undefined
        return (
          <DashboardCard
            key={id}
            icon={icon}
            label={`Missing ${label}`}
            value={String(count)}
            sublabel={sublabel}
            onClick={onFieldClick ? () => onFieldClick(id) : undefined}
          />
        )
      })}
    </div>
  )
}
