import { MapSearch } from './MapSearch'
import { MapFilterControls } from './MapFilterControls'
import type { Venue } from '../../../types/venue'
import type { Destination } from '../../../types/destination'

type MapToolbarProps = {
  searchCandidates: Venue[]
  onSelectVenue: (venue: Venue) => void
  categoryFilter: Set<string>
  onToggleCategory: (category: string) => void
  destinations: Destination[]
  destinationId: string
  onDestinationIdChange: (id: string) => void
  onFitAll: () => void
  onFitDestination: () => void
  onResetView: () => void
  onClearSelection: () => void
  hasSelection: boolean
}

/**
 * Desktop toolbar — unchanged since Phase 5, everything on one row.
 * `MobileMapToolbar` is the Phase 6 narrow-viewport counterpart; both
 * render the same `MapFilterControls` body so filter/view-control
 * behavior never drifts between the two presentations.
 */
export function MapToolbar({
  searchCandidates,
  onSelectVenue,
  categoryFilter,
  onToggleCategory,
  destinations,
  destinationId,
  onDestinationIdChange,
  onFitAll,
  onFitDestination,
  onResetView,
  onClearSelection,
  hasSelection,
}: MapToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-4 py-2">
      <div className="w-64">
        <MapSearch venues={searchCandidates} onSelect={onSelectVenue} />
      </div>
      <MapFilterControls
        categoryFilter={categoryFilter}
        onToggleCategory={onToggleCategory}
        destinations={destinations}
        destinationId={destinationId}
        onDestinationIdChange={onDestinationIdChange}
        onFitAll={onFitAll}
        onFitDestination={onFitDestination}
        onResetView={onResetView}
        onClearSelection={onClearSelection}
        hasSelection={hasSelection}
        viewControlsClassName="ml-auto flex flex-wrap items-center gap-2"
      />
    </div>
  )
}
