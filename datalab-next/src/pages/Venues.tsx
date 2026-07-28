import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { VenueListPanel } from '../features/venues/VenueListPanel'
import { VenueFilters } from '../features/venues/VenueFilters'
import { VenueCreateDialog } from '../features/venues/VenueCreateDialog'
import { VenueWorkspace } from '../features/venues/workspace/VenueWorkspace'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useAuth } from '../features/auth/useAuth'
import { hasPermission } from '../features/auth/permissions'
import { ExportButton } from '../components/ExportButton'
import { exportVenues } from '../features/venues/api'

/** Sprint 27 — search/filter state lives in the URL (`useSearchParams`),
 * not local component state, so a page refresh (or a shared/bookmarked
 * link) preserves exactly what was being searched for — this is the one
 * piece of state in this page that's meant to survive a reload, unlike
 * `selectedVenueId`/`isWorkspaceDirty`, which are legitimately session-only.
 * `q` debounces before it drives the actual query (`useVenues` inside
 * `VenueListPanel`), but the input itself (and the URL) update immediately
 * on every keystroke — typing feels instant, only the network request lags.
 */
export function Venues() {
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null)
  const [isWorkspaceDirty, setIsWorkspaceDirty] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  const q = searchParams.get('q') ?? ''
  const destinationId = searchParams.get('destination') ?? ''
  const category = searchParams.get('category') ?? ''
  const status = searchParams.get('status') ?? ''
  const debouncedQ = useDebouncedValue(q, 300)
  const { role } = useAuth()
  const canCreate = hasPermission(role, 'content_edit')

  function setParam(key: string, value: string) {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        if (value) {
          next.set(key, value)
        } else {
          next.delete(key)
        }
        return next
      },
      { replace: true },
    )
  }

  function handleSelectVenue(id: string) {
    if (isWorkspaceDirty) {
      const confirmed = window.confirm(
        'You have unsaved changes in this venue. Discard them and switch venues?',
      )
      if (!confirmed) return
    }
    setSelectedVenueId(id)
  }

  return (
    <div className="flex h-full gap-6">
      <div className="flex w-80 shrink-0 flex-col gap-3 overflow-y-auto">
        {canCreate && (
          <VenueCreateDialog onCreated={(venue) => handleSelectVenue(venue.id)} />
        )}
        <ExportButton label="Export venues" onExport={exportVenues} />
        <VenueFilters
          searchValue={q}
          onSearchChange={(value) => setParam('q', value)}
          destinationId={destinationId}
          onDestinationIdChange={(value) => setParam('destination', value)}
          category={category}
          onCategoryChange={(value) => setParam('category', value)}
          status={status}
          onStatusChange={(value) => setParam('status', value)}
        />
        <VenueListPanel
          selectedVenueId={selectedVenueId}
          onSelectVenue={handleSelectVenue}
          searchParams={{
            q: debouncedQ || undefined,
            destinationId: destinationId || undefined,
            category: category || undefined,
            status: status || undefined,
          }}
        />
      </div>
      <div className="min-w-0 flex-1 overflow-y-auto">
        <VenueWorkspace venueId={selectedVenueId} onDirtyChange={setIsWorkspaceDirty} />
      </div>
    </div>
  )
}
