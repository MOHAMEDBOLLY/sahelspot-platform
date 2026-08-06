import { HeartPulse } from 'lucide-react'
import { useApiHealth } from './useApiHealth'

/** API Health — reuses the existing `GET /health` endpoint exactly as-is
 * (unchanged, per Sprint 1's rule not to extend or redesign it). Display
 * only: no retry/refresh action, no restart control — a status readout,
 * nothing more. */
export function ApiHealthCard() {
  const { data, isPending, isError } = useApiHealth()

  const status = isPending ? 'Checking…' : isError ? 'Down' : 'Operational'
  const database = isPending ? '…' : isError ? 'Unknown' : data.database

  const statusClasses = isPending
    ? 'bg-gray-100 text-gray-600'
    : isError
      ? 'bg-red-100 text-red-700'
      : 'bg-green-100 text-green-700'

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <HeartPulse size={18} className="text-gray-500" />
        <h2 className="text-sm font-semibold text-gray-900">API Health</h2>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Status</p>
          <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusClasses}`}>
            {status}
          </span>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Database</p>
          <p className="text-sm font-medium text-gray-900">{database}</p>
        </div>
      </div>
    </div>
  )
}
