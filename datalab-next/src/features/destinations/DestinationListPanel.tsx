import { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'
import { useDestinations } from './useDestinations'
import { DestinationList } from './DestinationList'
import { BulkActionToolbar } from './BulkActionToolbar'
import { LoadingState } from '../../components/LoadingState'
import { ErrorState } from '../../components/ErrorState'
import { PagePlaceholder } from '../../components/PagePlaceholder'
import type { DestinationSearchParams } from '../../types/destination'

type DestinationListPanelProps = {
  selectedDestinationId: string | null
  onSelectDestination: (id: string) => void
  searchParams: DestinationSearchParams
}

/** Sprint 29 — `searchParams` is owned by the parent page (URL sync lives
 * there, same split venues' `VenueListPanel` already uses). Two distinct
 * empty states: "no destinations exist at all" vs. "no destinations match
 * the current search" — same reasoning venues' panel already documents. */
export function DestinationListPanel({
  selectedDestinationId,
  onSelectDestination,
  searchParams,
}: DestinationListPanelProps) {
  const { data, isPending, isError, error, refetch } = useDestinations(searchParams)
  const [checkedDestinationIds, setCheckedDestinationIds] = useState<Set<string>>(new Set())
  const hasActiveSearch = Boolean(searchParams.q)

  // Destination Lifecycle Management — same pruning-on-reload reasoning as
  // venues' `VenueListPanel`: a stale checked id can never linger past the
  // item it referred to being gone from the currently-loaded list.
  useEffect(() => {
    if (!data) return
    const visibleIds = new Set(data.items.map((destination) => destination.id))
    setCheckedDestinationIds((current) => {
      const pruned = new Set([...current].filter((id) => visibleIds.has(id)))
      return pruned.size === current.size ? current : pruned
    })
  }, [data])

  function toggleChecked(id: string) {
    setCheckedDestinationIds((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  if (isPending) {
    return <LoadingState label="Loading destinations…" />
  }

  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'Failed to load destinations.'}
        onRetry={() => refetch()}
      />
    )
  }

  if (!data || data.items.length === 0) {
    return hasActiveSearch ? (
      <PagePlaceholder
        icon={MapPin}
        title="No matching destinations"
        description="Try a different search term."
      />
    ) : (
      <PagePlaceholder
        icon={MapPin}
        title="No destinations yet"
        description="Destinations will appear here once they're added."
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {checkedDestinationIds.size > 0 && (
        <BulkActionToolbar
          checkedDestinations={data.items.filter((destination) => checkedDestinationIds.has(destination.id))}
          onClearSelection={() => setCheckedDestinationIds(new Set())}
        />
      )}
      <DestinationList
        destinations={data.items}
        selectedDestinationId={selectedDestinationId}
        onSelectDestination={onSelectDestination}
        checkedDestinationIds={checkedDestinationIds}
        onToggleChecked={toggleChecked}
      />
    </div>
  )
}
