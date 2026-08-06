import { Server } from 'lucide-react'
import { useSystemVersion } from './useSystemVersion'

const NOT_AVAILABLE = 'Not available'

/** System Information — pure display, no editing. Only Backend Version has
 * a real source today (`GET /`, unchanged). The other five fields have no
 * source anywhere in the codebase yet (no Consumer/Studio build-version
 * stamping, no environment field on any endpoint, no git-commit/deploy-time
 * metadata plumbed through) — shown as an explicit "Not available"
 * placeholder rather than inventing a value, per Sprint 1's scope: add the
 * dashboard shell only, no new instrumentation. */
export function SystemInformationCard() {
  const { data, isPending, isError } = useSystemVersion()
  const backendVersion = isPending ? '…' : isError || !data ? NOT_AVAILABLE : data.version

  const rows: Array<[label: string, value: string]> = [
    ['Consumer Version', NOT_AVAILABLE],
    ['Studio Version', NOT_AVAILABLE],
    ['Backend Version', backendVersion],
    ['Environment', NOT_AVAILABLE],
    ['Git Commit', NOT_AVAILABLE],
    ['Last Deployment', NOT_AVAILABLE],
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
