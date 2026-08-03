import { Search } from 'lucide-react'

const EVENT_STATUSES = ['draft', 'review', 'approved', 'archived'] as const

type EventFiltersProps = {
  searchValue: string
  onSearchChange: (value: string) => void
  status: string
  onStatusChange: (value: string) => void
  featuredOnly: boolean
  onFeaturedOnlyChange: (value: boolean) => void
}

const SELECT_CLASSNAME =
  'min-h-11 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none lg:min-h-0'

/** Events Module v1 — same shape as `VenueFilters`/`DestinationFilters`:
 * fully controlled, parent owns the actual values (URL-synced in
 * `pages/Events.tsx`, same split every other list page already uses). No
 * venue/destination filter select here — v1 doesn't need it; filtering
 * to a specific venue/destination's events happens from that venue's/
 * destination's own workspace later if ever needed (out of scope now).
 */
export function EventFilters({
  searchValue,
  onSearchChange,
  status,
  onStatusChange,
  featuredOnly,
  onFeaturedOnlyChange,
}: EventFiltersProps) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3">
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search events…"
          className="w-full rounded-lg border border-gray-300 py-1.5 pl-8 pr-3 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
        />
      </div>

      <select value={status} onChange={(event) => onStatusChange(event.target.value)} className={SELECT_CLASSNAME}>
        <option value="">All statuses</option>
        {EVENT_STATUSES.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>

      <label className="flex min-h-11 items-center gap-2 px-1 text-sm text-gray-700 lg:min-h-0">
        <input
          type="checkbox"
          checked={featuredOnly}
          onChange={(event) => onFeaturedOnlyChange(event.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
        Featured only
      </label>
    </div>
  )
}
