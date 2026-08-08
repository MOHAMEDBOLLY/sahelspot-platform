import { Archive, RefreshCw } from 'lucide-react'
import { HealthStatusBadge } from './HealthStatusBadge'
import { useBackupInfo } from './useBackupInfo'

const UNAVAILABLE = 'Unavailable'

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-start sm:gap-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="text-sm font-medium text-gray-900">{value}</dd>
    </div>
  )
}

/** Backup Dashboard (Phase 2B) — live data from `GET /system/backups`
 * (newest file in `api/backups/`, read-only), on demand only: mount + the
 * Refresh button, no polling. A missing directory, an empty one, or a
 * failed request all render as "Unavailable" per field rather than
 * crashing the card. */
export function BackupDashboardCard() {
  const { data, isPending, isError, isFetching, refetch } = useBackupInfo()

  const text = (value: string | null | undefined) => (value === null || value === undefined || value === '' ? UNAVAILABLE : value)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Archive size={18} className="text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-900">Backup Dashboard</h2>
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
          Backup data is unavailable — the request to /system/backups failed.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <HealthStatusBadge status={data.status} />
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            <Field label="Last Backup" value={text(data.last_backup)} />
            <Field label="Backup Age" value={text(data.backup_age)} />
            <Field label="Backup Size" value={text(data.backup_size)} />
            <Field label="Backup Location" value={text(data.backup_location)} />
          </dl>
        </div>
      )}
    </div>
  )
}
