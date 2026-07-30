import type { LucideIcon } from 'lucide-react'

type DashboardCardProps = {
  icon: LucideIcon
  label: string
  value: string
  sublabel?: string
  /** Not used by any caller yet — this phase is display-only, no
   * filtering or navigation (see docs/STUDIO_PRODUCT_GAP_AUDIT.md §6).
   * Reserved so a future drill-down phase can wire real navigation
   * without redesigning this component. When present, the card becomes
   * a real `<button>` (focusable, hover/focus affordance); when absent,
   * it renders as an inert `<div>`, matching this phase's display-only
   * scope exactly. */
  onClick?: () => void
}

/** Reusable dashboard summary tile — status breakdown, missing-data
 * counts, and destination progress all render through this so any future
 * dashboard addition (QA Center, analytics) looks consistent for free. */
export function DashboardCard({ icon: Icon, label, value, sublabel, onClick }: DashboardCardProps) {
  const content = (
    <>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
        <Icon size={18} />
      </div>
      <div className="min-w-0 text-left">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
        <p className="text-xl font-semibold text-gray-900">{value}</p>
        {sublabel && <p className="text-xs text-gray-400">{sublabel}</p>}
      </div>
    </>
  )

  if (!onClick) {
    return <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">{content}</div>
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gray-900"
    >
      {content}
    </button>
  )
}
