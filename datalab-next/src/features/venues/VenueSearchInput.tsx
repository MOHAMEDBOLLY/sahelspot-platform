import { Search } from 'lucide-react'

type VenueSearchInputProps = {
  value: string
  onChange: (value: string) => void
  className?: string
}

/** Extracted from `VenueFilters` so the phone layout can keep the search
 * box always visible (outside the filters `BottomSheet`) without a second,
 * independently-maintained copy of its markup — `VenueFilters` renders
 * this same component for its own (desktop-unchanged) search field. */
export function VenueSearchInput({ value, onChange, className = '' }: VenueSearchInputProps) {
  return (
    <div className={['relative', className].join(' ')}>
      <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search venues…"
        className="min-h-11 w-full rounded-lg border border-gray-300 py-1.5 pl-8 pr-3 text-sm text-gray-900 focus:border-gray-900 focus:outline-none lg:min-h-0"
      />
    </div>
  )
}
