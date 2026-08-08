type Status = 'healthy' | 'warning' | 'critical'

const STATUS_STYLES: Record<Status, string> = {
  healthy: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  critical: 'bg-red-100 text-red-700',
}

/** Shared traffic-light badge for the Operations dashboards (System
 * Health, Backup, Logs) — same green/yellow/red palette `ApiHealthCard`
 * already uses for its own status pill. */
export function HealthStatusBadge({ status }: { status: Status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  )
}
