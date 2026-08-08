import { Activity, RefreshCw } from 'lucide-react'
import { HealthStatusBadge } from './HealthStatusBadge'
import { useSystemHealth } from './useSystemHealth'

const UNAVAILABLE = 'Unavailable'

/** Green under 80%, yellow 80–90%, red over 90% — per this phase's spec. */
function barColor(percent: number): string {
  if (percent > 90) return 'bg-red-500'
  if (percent >= 80) return 'bg-yellow-500'
  return 'bg-emerald-500'
}

function ProgressBar({ percent, label }: { percent: number | null; label: string }) {
  if (percent === null) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium uppercase tracking-wide text-gray-500">{label}</span>
          <span className="font-medium text-gray-400">{UNAVAILABLE}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium uppercase tracking-wide text-gray-500">{label}</span>
        <span className="font-medium text-gray-900">{percent.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full ${barColor(percent)}`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-start sm:gap-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="text-sm font-medium text-gray-900">{value}</dd>
    </div>
  )
}

/** System Health Dashboard (Phase 2A — Server/Database/API only; Docker
 * monitoring is intentionally deferred). Live metrics from
 * `GET /system/health`, read on demand only: mount + the Refresh button,
 * no polling. A missing/unreachable endpoint, or a field the backend
 * itself couldn't read, both render as "Unavailable" rather than
 * crashing the card. The Docker section always shows "Unavailable" — not
 * an error, this phase's deliberate scope boundary. */
export function SystemHealthDashboard() {
  const { data, isPending, isError, isFetching, refetch } = useSystemHealth()

  const text = (value: string | number | null | undefined) =>
    value === null || value === undefined || value === '' ? UNAVAILABLE : String(value)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-900">System Health</h2>
          {data && <HealthStatusBadge status={data.status} />}
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
          System health data is unavailable — the request to /system/health failed.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-gray-400">As of {new Date(data.timestamp).toLocaleString()}</p>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <section className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Server</h3>
              <ProgressBar
                percent={data.server.cpu_percent}
                label={data.server.cpu_cores === null ? 'CPU' : `CPU (${data.server.cpu_cores} cores)`}
              />
              <ProgressBar percent={data.server.memory?.used_percent ?? null} label="RAM" />
              <ProgressBar percent={data.server.disk?.used_percent ?? null} label="Disk" />
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                <Field
                  label="Load Average"
                  value={
                    data.server.load_average === null
                      ? UNAVAILABLE
                      : `${data.server.load_average['1m'].toFixed(2)} / ${data.server.load_average['5m'].toFixed(2)} / ${data.server.load_average['15m'].toFixed(2)}`
                  }
                />
              </dl>
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Database</h3>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                <Field label="Status" value={text(data.database.status)} />
                <Field label="Latency" value={data.database.latency_ms === null ? UNAVAILABLE : `${data.database.latency_ms} ms`} />
                <Field label="Publish Revision" value={text(data.database.publish_revision)} />
                <Field label="Schema Revision" value={text(data.database.schema_revision)} />
              </dl>
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">API</h3>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                <Field label="Workers" value={text(data.api.workers)} />
                <Field label="Uptime" value={text(data.api.uptime)} />
                <Field label="Version" value={text(data.api.version)} />
                <Field label="Git Commit" value={text(data.api.git_commit)} />
              </dl>
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Docker</h3>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                <Field label="Status" value={UNAVAILABLE} />
              </dl>
            </section>
          </div>
        </div>
      )}
    </div>
  )
}
