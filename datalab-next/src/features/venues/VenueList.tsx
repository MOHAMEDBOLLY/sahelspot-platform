import type { Venue } from '../../types/venue'
import { StatusBadge } from '../../components/StatusBadge'

type VenueListProps = {
  venues: Venue[]
  selectedVenueId: string | null
  onSelectVenue: (id: string) => void
  /** Sprint 28 — bulk-operation checkbox selection. Deliberately a
   * separate concept from `selectedVenueId` (which venue's workspace is
   * open) — a venue can be checked for a bulk action without being the
   * one currently open, and vice versa. */
  checkedVenueIds: ReadonlySet<string>
  onToggleChecked: (id: string) => void
}

export function VenueList({
  venues,
  selectedVenueId,
  onSelectVenue,
  checkedVenueIds,
  onToggleChecked,
}: VenueListProps) {
  return (
    <ul className="flex flex-col divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
      {venues.map((venue) => {
        const isSelected = venue.id === selectedVenueId
        const isChecked = checkedVenueIds.has(venue.id)
        return (
          <li key={venue.id} className="flex items-stretch">
            <label
              className="flex shrink-0 items-center pl-3"
              onClick={(event) => event.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => onToggleChecked(venue.id)}
                aria-label={`Select ${venue.name}`}
                className="h-4 w-4 rounded border-gray-300"
              />
            </label>
            <button
              type="button"
              onClick={() => onSelectVenue(venue.id)}
              aria-current={isSelected ? 'true' : undefined}
              className={[
                'flex w-full flex-col gap-1.5 px-3 py-3 text-left transition-colors',
                isSelected ? 'bg-gray-900' : 'hover:bg-gray-50',
              ].join(' ')}
            >
              <span
                className={[
                  'truncate text-sm font-medium',
                  isSelected ? 'text-white' : 'text-gray-900',
                ].join(' ')}
              >
                {venue.name}
              </span>
              <span
                className={[
                  'truncate text-xs',
                  isSelected ? 'text-gray-300' : 'text-gray-500',
                ].join(' ')}
              >
                {venue.category} · {venue.destination.name}
              </span>
              <StatusBadge status={venue.status} />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
