import { FileText, RefreshCw } from 'lucide-react'
import { HealthStatusBadge } from './HealthStatusBadge'
import { useLogsInfo } from './useLogsInfo'

const UNAVAILABLE = 'Unavailable'

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-start sm:gap-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="text-sm font-medium text-gray-900">{value}</dd>
    </div>
  )
}

/** Logs Dashboard (Phase 2B) — live summary counts from `GET
 * /system/logs` (never log content), on demand only: mount + the Refresh
 * button, no polling. `nginx_errors` is permanently "Unavailable" — nginx
 * runs in a separate container this phase doesn't reach into, same
 * boundary Phase 2A drew around Docker monitoring. */
export function LogsDashboardCard() {
  const { data, isPending, isError, isFetching, refetch } = useLogsInfo()

  const text = (value: string | number | null | undefined) =>
    value === null || value === undefined || value === '' ? UNAVAILABLE : String(value)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-900">Logs Dashboard</h2>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {isPending ? (
        <p className="py-6 text-center text-sm text-gray-500">Loading…</p>
      ) : isError || !data ? (
        <p className="py-6 text-center text-sm text-red-600">
          Logs data is unavailable — the request to /system/logs failed.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <HealthStatusBadge status={data.status} />
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            <Field label="API Errors" value={text(data.api_errors)} />
            <Field label="Nginx Errors" value={text(data.nginx_errors)} />
            <Field label="Last Restart" value={text(data.last_restart)} />
            <Field label="Last Deploy" value={text(data.last_deploy)} />
          </dl>
        </div>
      )}
    </div>
  )
}
