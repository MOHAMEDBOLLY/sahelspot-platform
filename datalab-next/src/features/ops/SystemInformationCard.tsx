import { Server } from 'lucide-react'
import { useVersionInfo } from './useVersionInfo'

const UNAVAILABLE = 'Unavailable'

/** System Information — pure display, no editing. All eight fields come
 * from `GET /version`, which returns `version.json` (the single, manually-
 * updated source of truth) verbatim. A missing/unreachable endpoint falls
 * back to "Unavailable" per field rather than crashing the card. */
export function SystemInformationCard() {
  const { data, isPending, isError } = useVersionInfo()
  const field = (value: string | number | undefined) =>
    isPending ? '…' : isError || value === undefined || value === '' ? UNAVAILABLE : String(value)

  const rows: Array<[label: string, value: string]> = [
    ['Consumer Version', field(data?.consumer_version)],
    ['Studio Version', field(data?.studio_version)],
    ['Backend Version', field(data?.backend_version)],
    ['Environment', field(data?.environment)],
    ['Git Commit', field(data?.git_commit)],
    ['Last Deployment', field(data?.last_deployment)],
    ['Publish Revision', field(data?.publish_revision)],
    ['Schema Revision', field(data?.schema_revision)],
  ]

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <Server size={18} className="text-gray-500" />
        <h2 className="text-sm font-semibold text-gray-900">System Information</h2>
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 sm:flex-col sm:items-start sm:gap-0.5">
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</dt>
            <dd className="text-sm font-medium text-gray-900">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
