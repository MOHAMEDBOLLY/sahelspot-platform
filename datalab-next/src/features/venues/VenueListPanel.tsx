import { useEffect, useMemo, useState } from 'react'
import { Store } from 'lucide-react'
import { useVenueSearch } from './useVenueSearch'
import { VenueList } from './VenueList'
import { BulkActionToolbar } from './BulkActionToolbar'
import { LoadingState } from '../../components/LoadingState'
import { ErrorState } from '../../components/ErrorState'
import { PagePlaceholder } from '../../components/PagePlaceholder'
import { Pagination } from '../../components/Pagination'
import { evaluateVenueQuality, type VenueQuality } from '../../lib/venueQuality'
import { hasQualityFilter } from '../../lib/venueQualityFilter'
import type { VenueSearchParams } from '../../types/venue'

type VenueListPanelProps = {
  selectedVenueId: string | null
  onSelectVenue: (id: string) => void
  searchParams: VenueSearchParams
  onPageChange: (page: number) => void
}

/** Sprint 27 — `searchParams` is fully owned by the parent page (URL
 * synchronization lives there); this component only reacts to it. Two
 * distinct empty states: "no venues exist at all" vs. "no venues match
 * the current search/filters" — the latter needs a different message,
 * since "no venues yet" would be misleading once venues do exist.
 *
 * Sprint 28 — checkbox selection for bulk operations is owned here
 * (not lifted to the page), since it's purely a concern of "which of the
 * currently-loaded venues are checked" and never needs to interact with
 * the workspace or URL state the page owns. Pruned whenever the loaded
 * list changes (a new search/filter, a page change, or a bulk action
 * moving a venue out of the current view) so a stale checked id can
 * never linger past the item it referred to being gone from view — this
 * is also what makes "selection only applies to the current page" true
 * for free: `data.items` (and therefore `checkedVenueIds`) never
 * contains anything outside the currently-loaded page.
 *
 * Pagination controls render `data.total`/`data.page`/`data.page_size` —
 * the response shape already carried these; only the UI for them was
 * missing (see docs — the backend's own `page_size` default was never
 * the bug, the frontend just never asked for a second page or showed
 * that more existed).
 */
export function VenueListPanel({ selectedVenueId, onSelectVenue, searchParams, onPageChange }: VenueListPanelProps) {
  const { data, isPending, isError, error, refetch } = useVenueSearch(searchParams)
  const [checkedVenueIds, setCheckedVenueIds] = useState<Set<string>>(new Set())
  const hasActiveFilters = Boolean(
    searchParams.q ||
      searchParams.destinationId ||
      searchParams.category ||
      searchParams.status ||
      hasQualityFilter(searchParams.qualityFilter ?? {}),
  )

  useEffect(() => {
    if (!data) return
    const visibleIds = new Set(data.items.map((venue) => venue.id))
    setCheckedVenueIds((current) => {
      const pruned = new Set([...current].filter((id) => visibleIds.has(id)))
      return pruned.size === current.size ? current : pruned
    })
  }, [data])

  /** Evaluated once per venue per fetch, not per render — `data.items`
   * only changes reference on a new page/filter/refetch, so unrelated
   * re-renders (e.g. toggling a checkbox) don't re-run the evaluator. */
  const qualityByVenueId = useMemo(() => {
    const map = new Map<string, VenueQuality>()
    if (!data) return map
    for (const venue of data.items) {
      map.set(venue.id, evaluateVenueQuality(venue))
    }
    return map
  }, [data])

  function toggleChecked(id: string) {
    setCheckedVenueIds((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function toggleSelectAll() {
    if (!data) return
    setCheckedVenueIds((current) =>
      current.size === data.items.length ? new Set() : new Set(data.items.map((venue) => venue.id)),
    )
  }

  if (isPending) {
    return <LoadingState label="Loading venues…" />
  }

  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'Failed to load venues.'}
        onRetry={() => refetch()}
      />
    )
  }

  if (!data || data.items.length === 0) {
    return hasActiveFilters ? (
      <PagePlaceholder
        icon={Store}
        title="No matching venues"
        description="Try a different search term or clearing a filter."
      />
    ) : (
      <PagePlaceholder
        icon={Store}
        title="No venues yet"
        description="Venues will appear here once they're added."
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {checkedVenueIds.size > 0 && (
        <BulkActionToolbar
          checkedVenues={data.items.filter((venue) => checkedVenueIds.has(venue.id))}
          onClearSelection={() => setCheckedVenueIds(new Set())}
        />
      )}
      <label className="flex min-h-11 items-center gap-2 px-1 text-xs font-medium text-gray-500 lg:min-h-0">
        <input
          type="checkbox"
          checked={checkedVenueIds.size > 0 && checkedVenueIds.size === data.items.length}
          onChange={toggleSelectAll}
          className="h-4 w-4 rounded border-gray-300"
        />
        Select all on this page ({data.items.length})
      </label>
      <VenueList
        venues={data.items}
        selectedVenueId={selectedVenueId}
        onSelectVenue={onSelectVenue}
        checkedVenueIds={checkedVenueIds}
        onToggleChecked={toggleChecked}
        qualityByVenueId={qualityByVenueId}
      />
      <Pagination page={data.page} pageSize={data.page_size} total={data.total} onPageChange={onPageChange} />
    </div>
  )
}
