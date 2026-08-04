import type { Destination } from '../../types/destination'
import { StatusBadge } from '../../components/StatusBadge'

type DestinationListProps = {
  destinations: Destination[]
  selectedDestinationId: string | null
  onSelectDestination: (id: string) => void
  /** Destination Lifecycle Management — bulk-operation checkbox selection,
   * same separate-from-`selectedDestinationId` concept as venues'
   * `checkedVenueIds`/`onToggleChecked` (`features/venues/VenueList.tsx`). */
  checkedDestinationIds: ReadonlySet<string>
  onToggleChecked: (id: string) => void
}

/** Same row shape as `VenueList` — clickable rows, primary line, secondary
 * metadata line, status badge — but not sharing code with it: the two
 * entities' rows show genuinely different fields (venue: category +
 * destination name; destination: region), so following the same pattern
 * without forcing a shared component was the deliberate call here (see
 * docs/ROADMAP.md's Sprint 21 entry for the reasoning). */
export function DestinationList({
  destinations,
  selectedDestinationId,
  onSelectDestination,
  checkedDestinationIds,
  onToggleChecked,
}: DestinationListProps) {
  return (
    <ul className="flex shrink-0 flex-col divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
      {destinations.map((destination) => {
        const isSelected = destination.id === selectedDestinationId
        const isChecked = checkedDestinationIds.has(destination.id)
        return (
          <li key={destination.id} className="flex items-stretch">
            <label
              className="flex min-w-11 shrink-0 items-center justify-center pl-3 lg:min-w-0 lg:justify-start"
              onClick={(event) => event.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => onToggleChecked(destination.id)}
                aria-label={`Select ${destination.name}`}
                className="h-4 w-4 rounded border-gray-300"
              />
            </label>
            <button
              type="button"
              onClick={() => onSelectDestination(destination.id)}
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
                {destination.name}
              </span>
              <span
                className={[
                  'truncate text-xs',
                  isSelected ? 'text-gray-300' : 'text-gray-500',
                ].join(' ')}
              >
                {destination.region}
              </span>
              <StatusBadge status={destination.status} />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
