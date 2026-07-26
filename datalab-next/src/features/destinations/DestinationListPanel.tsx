import { MapPin } from 'lucide-react'
import { useDestinations } from './useDestinations'
import { DestinationList } from './DestinationList'
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
  const hasActiveSearch = Boolean(searchParams.q)

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
    <DestinationList
      destinations={data.items}
      selectedDestinationId={selectedDestinationId}
      onSelectDestination={onSelectDestination}
    />
  )
}
