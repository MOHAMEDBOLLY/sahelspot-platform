import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { VENUE_CATEGORY_COLORS } from '../styling/venueMarkerStyle'
import type { Venue } from '../../../types/venue'

type MapSearchProps = {
  /** Candidates to search within — the page passes the currently
   * filtered venue list, so search results always match what's actually
   * visible on the map (category/destination filters already applied). */
  venues: Venue[]
  onSelect: (venue: Venue) => void
}

const MAX_RESULTS = 8

function matches(venue: Venue, query: string): boolean {
  const needle = query.toLowerCase()
  return (
    venue.name.toLowerCase().includes(needle) ||
    venue.category.toLowerCase().includes(needle) ||
    venue.destination.name.toLowerCase().includes(needle)
  )
}

function optionId(venueId: string): string {
  return `map-search-option-${venueId}`
}

/** Client-side only — searches the venue list already in memory, no
 * fetch. Selecting a result is the caller's job (`onSelect`): this
 * component doesn't know about `SelectionManager`/`CameraController`,
 * it only reports which `Venue` was picked, same "controlled, dumb"
 * shape as `VenueSearchInput`/`VenueFilters` elsewhere in Studio.
 * Owns its own `Ctrl/Cmd+K` focus shortcut since it's the only thing
 * that needs the input ref.
 *
 * Phase 6 — full combobox keyboard support (↑/↓ moves the active
 * option, Enter selects it, Escape closes) via a plain `activeIndex`
 * integer and `aria-activedescendant`, matching the ARIA combobox
 * pattern without pulling in any new dependency.
 */
export function MapSearch({ venues, onSelect }: MapSearchProps) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const trimmedQuery = query.trim()
  const results = trimmedQuery ? venues.filter((venue) => matches(venue, query)).slice(0, MAX_RESULTS) : []
  const showDropdown = isOpen && trimmedQuery.length > 0

  function handleSelect(venue: Venue) {
    onSelect(venue)
    setQuery('')
    setIsOpen(false)
    setActiveIndex(-1)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape' && isOpen) {
      event.stopPropagation()
      setIsOpen(false)
      setActiveIndex(-1)
      return
    }
    if (!showDropdown || results.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((previous) => (previous + 1) % results.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((previous) => (previous <= 0 ? results.length - 1 : previous - 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const venue = results[activeIndex] ?? results[0]
      if (venue) handleSelect(venue)
    }
  }

  return (
    <div className="relative w-full">
      <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setIsOpen(true)
          setActiveIndex(-1)
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Search venues, categories, destinations… (⌘K)"
        aria-label="Search venues"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showDropdown}
        aria-controls="map-search-results"
        aria-activedescendant={activeIndex >= 0 && results[activeIndex] ? optionId(results[activeIndex].id) : undefined}
        className="min-h-11 w-full rounded-lg border border-gray-300 py-1.5 pl-8 pr-3 text-sm text-gray-900 focus:border-gray-900 focus:outline-none lg:min-h-0"
      />
      {showDropdown && (
        <ul
          id="map-search-results"
          role="listbox"
          className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-500">No venues match "{trimmedQuery}".</li>
          ) : (
            results.map((venue, index) => (
              <li key={venue.id} id={optionId(venue.id)} role="option" aria-selected={index === activeIndex}>
                <button
                  type="button"
                  onClick={() => handleSelect(venue)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={[
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm focus-visible:outline-none',
                    index === activeIndex ? 'bg-gray-50' : 'hover:bg-gray-50',
                  ].join(' ')}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{
                      backgroundColor:
                        VENUE_CATEGORY_COLORS[venue.category as keyof typeof VENUE_CATEGORY_COLORS] ?? '#6B7280',
                    }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate text-gray-900">{venue.name}</span>
                  <span className="shrink-0 text-xs text-gray-400">{venue.destination.name}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
