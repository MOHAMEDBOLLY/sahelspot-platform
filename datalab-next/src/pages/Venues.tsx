import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowLeft, SlidersHorizontal } from 'lucide-react'
import { VenueListPanel } from '../features/venues/VenueListPanel'
import { VenueFilters } from '../features/venues/VenueFilters'
import { VenueSearchInput } from '../features/venues/VenueSearchInput'
import { AdvancedFilters } from '../features/venues/AdvancedFilters'
import { ActiveFilterChips } from '../features/venues/ActiveFilterChips'
import { SavedViewsPanel } from '../features/venues/SavedViewsPanel'
import { VenueCreateDialog } from '../features/venues/VenueCreateDialog'
import { VenueWorkspace } from '../features/venues/workspace/VenueWorkspace'
import { BottomSheet } from '../components/BottomSheet'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useAuth } from '../features/auth/useAuth'
import { hasPermission } from '../features/auth/permissions'
import { ExportButton } from '../components/ExportButton'
import { exportVenues } from '../features/venues/api'
import {
  parseQualityFilterParams,
  qualityFilterUrlKeys,
  serializeQualityFilterParams,
  type QualityFilterParams,
} from '../lib/venueQualityFilter'

/** Sprint 27 — search/filter state lives in the URL (`useSearchParams`),
 * not local component state, so a page refresh (or a shared/bookmarked
 * link) preserves exactly what was being searched for — this is the one
 * piece of state in this page that's meant to survive a reload, unlike
 * `selectedVenueId`/`isWorkspaceDirty`, which are legitimately session-only.
 * `q` debounces before it drives the actual query (`useVenues` inside
 * `VenueListPanel`), but the input itself (and the URL) update immediately
 * on every keystroke — typing feels instant, only the network request lags.
 *
 * Phase 2 Sprint 2 — Advanced Filters/Saved Views add no second state
 * mechanism: `qualityFilter` is parsed from (and written back to) this
 * same `URLSearchParams` object via `venueQualityFilter.ts`'s
 * parse/serialize functions, and Saved Views persist exactly this URL's
 * query string. Nothing about filter state exists outside the URL.
 */
export function Venues() {
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null)
  const [isWorkspaceDirty, setIsWorkspaceDirty] = useState(false)
  const [filtersSheetOpen, setFiltersSheetOpen] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  const q = searchParams.get('q') ?? ''
  const destinationId = searchParams.get('destination') ?? ''
  const category = searchParams.get('category') ?? ''
  const status = searchParams.get('status') ?? ''
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1)
  const debouncedQ = useDebouncedValue(q, 300)

  // Phase 2 — Advanced Filters. `parseQualityFilterParams` is the single
  // place URL params become a `QualityFilterParams` value (also used by
  // Saved Views' restore path indirectly, since restoring just sets these
  // same URL keys). An unrecognized/malformed value is dropped rather than
  // sent through, matching how an unrecognized `category`/`status` value
  // already behaves elsewhere in this page.
  const qualityFilter = useMemo(() => parseQualityFilterParams(searchParams), [searchParams])
  const { role, user } = useAuth()
  const canCreate = hasPermission(role, 'content_edit')

  /** Changing a filter always resets to page 1 — the previous page number
   * almost certainly doesn't make sense against a new result set (and
   * may not even exist), so `setFilterParam` clears `page` from the URL
   * on every call. `setPage` (used by the Pagination control itself)
   * deliberately doesn't go through this — it's the one thing allowed to
   * set `page` to something other than 1. */
  function setFilterParam(key: string, value: string) {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        if (value) {
          next.set(key, value)
        } else {
          next.delete(key)
        }
        next.delete('page')
        return next
      },
      { replace: true },
    )
  }

  /** The one place `QualityFilterParams` gets written back to the URL —
   * clears every quality-filter key first (so removing the last value of
   * a dimension actually removes it), then sets whatever `next` still
   * has. Used by `AdvancedFilters`, `ActiveFilterChips`' per-chip removal,
   * and "Clear All". */
  function updateQualityFilter(next: QualityFilterParams) {
    setSearchParams(
      (previous) => {
        const params = new URLSearchParams(previous)
        for (const key of qualityFilterUrlKeys()) params.delete(key)
        for (const [key, value] of Object.entries(serializeQualityFilterParams(next))) {
          params.set(key, value)
        }
        params.delete('page')
        return params
      },
      { replace: true },
    )
  }

  function clearAllFilters() {
    setSearchParams(
      (previous) => {
        const params = new URLSearchParams(previous)
        params.delete('q')
        params.delete('destination')
        params.delete('category')
        params.delete('status')
        params.delete('page')
        for (const key of qualityFilterUrlKeys()) params.delete(key)
        return params
      },
      { replace: true },
    )
  }

  function setPage(nextPage: number) {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        if (nextPage <= 1) {
          next.delete('page')
        } else {
          next.set('page', String(nextPage))
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

  /** Phone/tablet only (`lg:` always shows both panes, so this control
   * never renders there) — same dirty-check as switching between venues,
   * since leaving the workspace for the list is the same kind of
   * potential-data-loss action. */
  function handleBackToList() {
    if (isWorkspaceDirty) {
      const confirmed = window.confirm('You have unsaved changes in this venue. Discard them and go back?')
      if (!confirmed) return
    }
    setSelectedVenueId(null)
  }

  // The exact params a Saved View should persist — everything in the URL
  // except pagination, which is never part of "what search is this."
  const currentParamsForSavedView = useMemo(() => {
    const params: Record<string, string> = {}
    for (const [key, value] of searchParams.entries()) {
      if (key === 'page') continue
      params[key] = value
    }
    return params
  }, [searchParams])

  // Phone/tablet (below `lg:`): show either the list pane or the
  // workspace pane, never both — there isn't room for a real side-by-side
  // master-detail layout under 1024px. `lg:` always shows both, exactly
  // as before this sprint (both wrappers force `lg:flex`/`lg:w-80`
  // regardless of `selectedVenueId`).
  const showWorkspacePane = selectedVenueId !== null

  return (
    <div className="flex h-full gap-6">
      <div
        className={[
          showWorkspacePane ? 'hidden lg:flex' : 'flex',
          'w-full shrink-0 flex-col gap-3 overflow-y-auto lg:w-80',
        ].join(' ')}
      >
        {canCreate && (
          <VenueCreateDialog onCreated={(venue) => handleSelectVenue(venue.id)} />
        )}
        <ExportButton label="Export venues" onExport={exportVenues} />
        {user && <SavedViewsPanel userId={user.id} currentParams={currentParamsForSavedView} />}
        <ActiveFilterChips
          q={q}
          onClearQ={() => setFilterParam('q', '')}
          destinationId={destinationId}
          onClearDestination={() => setFilterParam('destination', '')}
          category={category}
          onClearCategory={() => setFilterParam('category', '')}
          status={status}
          onClearStatus={() => setFilterParam('status', '')}
          qualityFilter={qualityFilter}
          onQualityFilterChange={updateQualityFilter}
          onClearAll={clearAllFilters}
        />

        {/* Desktop: unchanged inline filters panel. */}
        <div className="hidden lg:flex lg:flex-col lg:gap-3">
          <VenueFilters
            searchValue={q}
            onSearchChange={(value) => setFilterParam('q', value)}
            destinationId={destinationId}
            onDestinationIdChange={(value) => setFilterParam('destination', value)}
            category={category}
            onCategoryChange={(value) => setFilterParam('category', value)}
            status={status}
            onStatusChange={(value) => setFilterParam('status', value)}
          />
          <AdvancedFilters params={qualityFilter} onChange={updateQualityFilter} />
        </div>

        {/* Phone/tablet: search stays visible; everything else (the same
            VenueFilters selects + AdvancedFilters, unchanged) moves into
            a BottomSheet — no second filtering UI, just a different
            container for the same controls. */}
        <div className="flex flex-col gap-2 lg:hidden">
          <VenueSearchInput value={q} onChange={(value) => setFilterParam('q', value)} />
          <button
            type="button"
            onClick={() => setFiltersSheetOpen(true)}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <SlidersHorizontal size={14} />
            Filters
          </button>
        </div>
        <BottomSheet open={filtersSheetOpen} onClose={() => setFiltersSheetOpen(false)} title="Filters">
          <div className="flex flex-col gap-3">
            <VenueFilters
              showSearch={false}
              searchValue={q}
              onSearchChange={(value) => setFilterParam('q', value)}
              destinationId={destinationId}
              onDestinationIdChange={(value) => setFilterParam('destination', value)}
              category={category}
              onCategoryChange={(value) => setFilterParam('category', value)}
              status={status}
              onStatusChange={(value) => setFilterParam('status', value)}
            />
            <AdvancedFilters params={qualityFilter} onChange={updateQualityFilter} />
          </div>
        </BottomSheet>

        <VenueListPanel
          selectedVenueId={selectedVenueId}
          onSelectVenue={handleSelectVenue}
          searchParams={{
            q: debouncedQ || undefined,
            destinationId: destinationId || undefined,
            category: category || undefined,
            status: status || undefined,
            page,
            qualityFilter,
          }}
          onPageChange={setPage}
        />
      </div>
      <div
        className={[
          showWorkspacePane ? 'flex' : 'hidden lg:flex',
          'min-w-0 flex-1 flex-col overflow-y-auto',
        ].join(' ')}
      >
        {selectedVenueId && (
          <button
            type="button"
            onClick={handleBackToList}
            className="flex min-h-11 items-center gap-1.5 self-start px-1 text-sm font-medium text-gray-600 hover:text-gray-900 lg:hidden"
          >
            <ArrowLeft size={16} />
            Back to venues
          </button>
        )}
        <VenueWorkspace
          venueId={selectedVenueId}
          onDirtyChange={setIsWorkspaceDirty}
          onDeleted={() => setSelectedVenueId(null)}
        />
      </div>
    </div>
  )
}
