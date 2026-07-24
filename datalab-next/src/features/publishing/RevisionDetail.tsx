import { FileClock, MapPin, Store } from 'lucide-react'
import { useRevisionDetail } from './useRevisionDetail'
import { RevisionField } from './RevisionField'
import { LoadingState } from '../../components/LoadingState'
import { ErrorState } from '../../components/ErrorState'
import { PagePlaceholder } from '../../components/PagePlaceholder'
import { formatDateTime } from '../../lib/formatDate'

type RevisionDetailProps = {
  revisionId: number | null
}

/** Read-only inspection of a single revision — metadata plus a snapshot
 * summary (names/categories, not the full per-field record). No edit, no
 * delete, no restore/rollback action anywhere in this component, by
 * design: this page only reads history, it never changes what's current. */
export function RevisionDetail({ revisionId }: RevisionDetailProps) {
  const { data: revision, isPending, isError, error, refetch } = useRevisionDetail(revisionId)

  if (!revisionId) {
    return (
      <PagePlaceholder
        icon={FileClock}
        title="No revision selected"
        description="Select a revision from the list to inspect it."
      />
    )
  }

  if (isPending) {
    return <LoadingState label="Loading revision…" />
  }

  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'Failed to load revision.'}
        onRetry={() => refetch()}
      />
    )
  }

  if (!revision) {
    return null
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-gray-900">Revision #{revision.id}</h2>
        {revision.is_current && (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Current
          </span>
        )}
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <FileClock size={16} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">Metadata</h3>
        </div>
        <dl className="grid grid-cols-2 gap-4">
          <RevisionField label="Published At" value={formatDateTime(revision.published_at)} />
          <RevisionField label="Published By" value={revision.published_by} />
          <RevisionField label="Label" value={revision.label} />
          <RevisionField label="Destinations" value={revision.destination_count} />
          <RevisionField label="Venues" value={revision.venue_count} />
        </dl>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <MapPin size={16} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">Destinations in this revision</h3>
        </div>
        {revision.snapshot.destinations.length === 0 ? (
          <p className="text-sm text-gray-400 italic">None</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {revision.snapshot.destinations.map((destination) => (
              <li key={destination.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-900">{destination.name}</span>
                <span className="text-gray-500">{destination.region}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <Store size={16} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">Venues in this revision</h3>
        </div>
        {revision.snapshot.venues.length === 0 ? (
          <p className="text-sm text-gray-400 italic">None</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {revision.snapshot.venues.map((venue) => (
              <li key={venue.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-900">{venue.name}</span>
                <span className="text-gray-500">{venue.category}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
