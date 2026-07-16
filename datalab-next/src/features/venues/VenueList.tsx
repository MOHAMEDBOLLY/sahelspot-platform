import type { Venue } from '../../types/venue'
import { StatusBadge } from '../../components/StatusBadge'

type VenueListProps = {
  venues: Venue[]
  selectedVenueId: string | null
  onSelectVenue: (id: string) => void
}

export function VenueList({ venues, selectedVenueId, onSelectVenue }: VenueListProps) {
  return (
    <ul className="flex flex-col divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
      {venues.map((venue) => {
        const isSelected = venue.id === selectedVenueId
        return (
          <li key={venue.id}>
            <button
              type="button"
              onClick={() => onSelectVenue(venue.id)}
              aria-current={isSelected ? 'true' : undefined}
              className={[
                'flex w-full flex-col gap-1.5 px-4 py-3 text-left transition-colors',
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
