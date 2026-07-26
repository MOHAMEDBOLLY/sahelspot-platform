import { Search } from 'lucide-react'
import { useDestinations } from '../destinations/useDestinations'
import { VENUE_CATEGORIES } from './venueCategories'

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
}

const SELECT_CLASSNAME =
  'rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none'

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
}: VenueFiltersProps) {
  // Sprint 29: useDestinations() now returns a paginated envelope
  // ({items, total, ...}), not a bare array — .items is the list itself.
  const { data: destinationsData } = useDestinations()
  const destinations = destinationsData?.items

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3">
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search venues…"
          className="w-full rounded-lg border border-gray-300 py-1.5 pl-8 pr-3 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
        />
      </div>

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
