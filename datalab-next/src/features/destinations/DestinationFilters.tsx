import { Search } from 'lucide-react'

type DestinationFiltersProps = {
  searchValue: string
  onSearchChange: (value: string) => void
}

/** Sprint 29 — search only, adapted from venues' `VenueFilters` (Sprint
 * 27) minus the destination/category/status selects: destinations have
 * no equivalent fields to filter by, and no filter beyond `q` was in this
 * sprint's scope. */
export function DestinationFilters({ searchValue, onSearchChange }: DestinationFiltersProps) {
  return (
    <div className="relative">
      <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        type="search"
        value={searchValue}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search destinations…"
        className="w-full rounded-lg border border-gray-300 py-1.5 pl-8 pr-3 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
      />
    </div>
  )
}
