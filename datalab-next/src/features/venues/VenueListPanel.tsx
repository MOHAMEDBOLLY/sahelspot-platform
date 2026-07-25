import { Store } from 'lucide-react'
import { useVenues } from './useVenues'
import { VenueList } from './VenueList'
import { LoadingState } from '../../components/LoadingState'
import { ErrorState } from '../../components/ErrorState'
import { PagePlaceholder } from '../../components/PagePlaceholder'
import type { VenueSearchParams } from '../../types/venue'

type VenueListPanelProps = {
  selectedVenueId: string | null
  onSelectVenue: (id: string) => void
  searchParams: VenueSearchParams
}

/** Sprint 27 — `searchParams` is fully owned by the parent page (URL
 * synchronization lives there); this component only reacts to it. Two
 * distinct empty states: "no venues exist at all" vs. "no venues match
 * the current search/filters" — the latter needs a different message,
 * since "no venues yet" would be misleading once venues do exist. */
export function VenueListPanel({ selectedVenueId, onSelectVenue, searchParams }: VenueListPanelProps) {
  const { data, isPending, isError, error, refetch } = useVenues(searchParams)
  const hasActiveFilters = Boolean(
    searchParams.q || searchParams.destinationId || searchParams.category || searchParams.status,
  )

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

  return <VenueList venues={data.items} selectedVenueId={selectedVenueId} onSelectVenue={onSelectVenue} />
}
