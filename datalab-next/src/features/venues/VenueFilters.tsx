import { useDestinations } from '../destinations/useDestinations'
import { VENUE_CATEGORIES } from './venueCategories'
import { VenueSearchInput } from './VenueSearchInput'

const VENUE_STATUSES = ['draft', 'review', 'approved', 'archived'] as const

type VenueFiltersProps = {
  searchValue: string
  onSearchChange: (value: string) => void
  destinationId: string
  onDestinationIdChange: (value: string) => void
  category: string
  onCategoryChange: (value: string) => void
  status: string
  onStatusChange: (value: string) => void
  /** Phone layout keeps the search box always visible outside this
   * component's `BottomSheet` instance (see `pages/Venues.tsx`) — set to
   * `false` there so it isn't rendered twice. Desktop always renders it
   * (default `true`), unchanged from before this sprint. */
  showSearch?: boolean
}

/** `min-h-11` (44px touch target) below `lg:`, `lg:min-h-0` restores the
 * exact pre-sprint box (content + `py-1.5` only) at desktop. */
const SELECT_CLASSNAME =
  'min-h-11 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none lg:min-h-0'

/** Sprint 27 — Search & Filter Foundation. Purely controlled: all values
 * and change handlers come from the parent page, which is what owns URL
 * synchronization (see `pages/Venues.tsx`) — this component doesn't know
 * or care that its state happens to be persisted in the URL. Destinations
 * are fetched (already a real list elsewhere in Studio); categories and
 * statuses are the same small, fixed, client-side lists the rest of the
 * app already uses (`venueCategories.ts`, and the shared editorial status
 * vocabulary from docs/DATABASE.md) — not fetched, same reasoning as
 * everywhere else those lists appear. */
export function VenueFilters({
  searchValue,
  onSearchChange,
  destinationId,
  onDestinationIdChange,
  category,
  onCategoryChange,
  status,
  onStatusChange,
  showSearch = true,
}: VenueFiltersProps) {
  // Sprint 29: useDestinations() now returns a paginated envelope
  // ({items, total, ...}), not a bare array — .items is the list itself.
  const { data: destinationsData } = useDestinations()
  const destinations = destinationsData?.items

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3">
      {showSearch && <VenueSearchInput value={searchValue} onChange={onSearchChange} />}

      <select
        value={destinationId}
        onChange={(event) => onDestinationIdChange(event.target.value)}
        className={SELECT_CLASSNAME}
      >
        <option value="">All destinations</option>
        {destinations?.map((destination) => (
          <option key={destination.id} value={destination.id}>
            {destination.name}
          </option>
        ))}
      </select>

      <select
        value={category}
        onChange={(event) => onCategoryChange(event.target.value)}
        className={SELECT_CLASSNAME}
      >
        <option value="">All categories</option>
        {VENUE_CATEGORIES.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>

      <select value={status} onChange={(event) => onStatusChange(event.target.value)} className={SELECT_CLASSNAME}>
        <option value="">All statuses</option>
        {VENUE_STATUSES.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
    </div>
  )
}
