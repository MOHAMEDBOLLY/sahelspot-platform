import { UploadCloud } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useRevisions } from '../publishing/useRevisions'

/** Publishing Summary — reuses the existing Publishing module's own data
 * (`useRevisions`, unchanged) rather than a new endpoint. Summary only: no
 * publish/republish control lives here — the whole card is a link to the
 * Publishing page, which already owns that functionality. */
export function PublishingSummaryCard() {
  const { data, isPending, isError } = useRevisions()
  const current = data?.find((revision) => revision.is_current) ?? null

  return (
    <Link
      to="/publishing"
      className="block rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-gray-300 hover:bg-gray-50"
    >
      <div className="mb-3 flex items-center gap-2">
        <UploadCloud size={18} className="text-gray-500" />
        <h2 className="text-sm font-semibold text-gray-900">Publishing Summary</h2>
      </div>

      {isPending ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : isError ? (
        <p className="text-sm text-gray-500">Unable to load publishing status.</p>
      ) : !current ? (
        <p className="text-sm text-gray-500">No published revision yet.</p>
      ) : (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Current Revision</dt>
            <dd className="text-sm font-medium text-gray-900">#{current.id}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Published</dt>
            <dd className="text-sm font-medium text-gray-900">
              {new Date(current.published_at).toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Venues</dt>
            <dd className="text-sm font-medium text-gray-900">{current.venue_count ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Destinations</dt>
            <dd className="text-sm font-medium text-gray-900">{current.destination_count ?? '—'}</dd>
          </div>
        </dl>
      )}

      <p className="mt-3 text-xs font-medium text-gray-400">View Publishing →</p>
    </Link>
  )
}
