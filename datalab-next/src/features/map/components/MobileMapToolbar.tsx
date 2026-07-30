import { useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { MapSearch } from './MapSearch'
import { MapFilterControls } from './MapFilterControls'
import { BottomSheet } from '../../../components/BottomSheet'
import { VENUE_CATEGORIES } from '../../venues/venueCategories'
import type { Venue } from '../../../types/venue'
import type { Destination } from '../../../types/destination'

type MobileMapToolbarProps = {
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
 * Phase 6 — the desktop toolbar's 13 category chips plus destination
 * select plus four view buttons wrap to 3+ rows on a phone, eating most
 * of the viewport before the map even starts. Mobile instead shows only
 * the search bar (the thing most likely to be reached for immediately)
 * plus a single "Filters" button that opens the same `MapFilterControls`
 * inside a `BottomSheet` — same generic primitive `VenueDetailPanel`
 * already uses, no new overlay mechanism. Desktop (`MapToolbar`) is
 * untouched; this is a separate component, not a conditional inside it,
 * so neither presentation risks affecting the other.
 */
export function MobileMapToolbar({
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
}: MobileMapToolbarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const activeFilterCount =
    (VENUE_CATEGORIES.length - categoryFilter.size) + (destinationId ? 1 : 0)

  return (
    <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-4 py-2">
      <div className="min-w-0 flex-1">
        <MapSearch venues={searchCandidates} onSelect={onSelectVenue} />
      </div>
      <button
        type="button"
        onClick={() => setFiltersOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={filtersOpen}
        className="relative flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gray-900"
      >
        <SlidersHorizontal size={14} />
        Filters
        {activeFilterCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-gray-900 text-[10px] font-semibold text-white">
            {activeFilterCount}
          </span>
        )}
      </button>

      <BottomSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters & view">
        <div className="flex flex-col gap-3">
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
          />
        </div>
      </BottomSheet>
    </div>
  )
}
