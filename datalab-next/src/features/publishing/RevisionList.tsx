import { formatDateTime } from '../../lib/formatDate'
import type { PublishRevisionSummary } from './types'

type RevisionListProps = {
  revisions: PublishRevisionSummary[]
  selectedRevisionId: number | null
  onSelectRevision: (id: number) => void
}

/** Read-only revision rows — no action beyond selecting one to inspect.
 * There is no edit, delete, or restore affordance anywhere in this list,
 * by design (see docs/ARCHITECTURE.md — the Revision Browser is read-only). */
export function RevisionList({ revisions, selectedRevisionId, onSelectRevision }: RevisionListProps) {
  return (
    <ul className="flex flex-col divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
      {revisions.map((revision) => {
        const isSelected = revision.id === selectedRevisionId
        return (
          <li key={revision.id}>
            <button
              type="button"
              onClick={() => onSelectRevision(revision.id)}
              aria-current={isSelected ? 'true' : undefined}
              className={[
                'flex w-full flex-col gap-1.5 px-4 py-3 text-left transition-colors',
                isSelected ? 'bg-gray-900' : 'hover:bg-gray-50',
              ].join(' ')}
            >
              <span className="flex items-center gap-2">
                <span className={['truncate text-sm font-medium', isSelected ? 'text-white' : 'text-gray-900'].join(' ')}>
                  Revision #{revision.id}
                </span>
                {revision.is_current && (
                  <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Current
                  </span>
                )}
              </span>
              <span className={['truncate text-xs', isSelected ? 'text-gray-300' : 'text-gray-500'].join(' ')}>
                {formatDateTime(revision.published_at)}
              </span>
              <span className={['truncate text-xs', isSelected ? 'text-gray-300' : 'text-gray-500'].join(' ')}>
                {revision.destination_count ?? 0} destination{revision.destination_count === 1 ? '' : 's'} ·{' '}
                {revision.venue_count ?? 0} venue{revision.venue_count === 1 ? '' : 's'}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
