import { Crosshair, Maximize, RotateCcw, X } from 'lucide-react'
import { VENUE_CATEGORIES } from '../../venues/venueCategories'
import { VENUE_CATEGORY_COLORS } from '../styling/venueMarkerStyle'
import type { Destination } from '../../../types/destination'

type MapFilterControlsProps = {
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
  /** Desktop pushes the view-control buttons to the right of the row
   * (`ml-auto`); the mobile sheet stacks everything left-aligned. Kept
   * as a prop rather than two component copies so the buttons
   * themselves never drift between presentations. */
  viewControlsClassName?: string
}

export const SELECT_CLASSNAME =
  'min-h-11 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none lg:min-h-0'

export const VIEW_BUTTON_CLASSNAME =
  'flex min-h-11 items-center gap-1.5 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gray-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent lg:min-h-0'

/**
 * Phase 6 — extracted from `MapToolbar` so the same destination
 * select/category chips/view buttons can be reused inside the desktop
 * inline toolbar AND the mobile filters `BottomSheet`, instead of two
 * copies drifting apart. Purely controlled, same shape as before.
 */
export function MapFilterControls({
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
  viewControlsClassName = 'flex flex-wrap items-center gap-2',
}: MapFilterControlsProps) {
  return (
    <>
      <select
        value={destinationId}
        onChange={(event) => onDestinationIdChange(event.target.value)}
        aria-label="Filter by destination"
        className={SELECT_CLASSNAME}
      >
        <option value="">All destinations</option>
        {destinations.map((destination) => (
          <option key={destination.id} value={destination.id}>
            {destination.name}
          </option>
        ))}
      </select>

      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Filter by category">
        {VENUE_CATEGORIES.map((category) => {
          const active = categoryFilter.has(category)
          return (
            <button
              key={category}
              type="button"
              onClick={() => onToggleCategory(category)}
              aria-pressed={active}
              className={[
                'flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gray-900',
                active
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50',
              ].join(' ')}
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{
                  backgroundColor: active
                    ? '#ffffff'
                    : (VENUE_CATEGORY_COLORS[category as keyof typeof VENUE_CATEGORY_COLORS] ?? '#6B7280'),
                }}
                aria-hidden="true"
              />
              {category}
            </button>
          )
        })}
      </div>

      <div className={viewControlsClassName}>
        <button type="button" onClick={onFitAll} className={VIEW_BUTTON_CLASSNAME}>
          <Maximize size={14} />
          Fit all
        </button>
        <button type="button" onClick={onFitDestination} disabled={!destinationId} className={VIEW_BUTTON_CLASSNAME}>
          <Crosshair size={14} />
          Fit destination
        </button>
        <button type="button" onClick={onResetView} className={VIEW_BUTTON_CLASSNAME}>
          <RotateCcw size={14} />
          Reset view
        </button>
        <button type="button" onClick={onClearSelection} disabled={!hasSelection} className={VIEW_BUTTON_CLASSNAME}>
          <X size={14} />
          Clear selection
        </button>
      </div>
    </>
  )
}
