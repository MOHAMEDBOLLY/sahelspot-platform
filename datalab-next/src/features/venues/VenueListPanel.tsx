import { Store } from 'lucide-react'
import { useVenues } from './useVenues'
import { VenueList } from './VenueList'
import { LoadingState } from '../../components/LoadingState'
import { ErrorState } from '../../components/ErrorState'
import { PagePlaceholder } from '../../components/PagePlaceholder'

type VenueListPanelProps = {
  selectedVenueId: string | null
  onSelectVenue: (id: string) => void
}

export function VenueListPanel({ selectedVenueId, onSelectVenue }: VenueListPanelProps) {
  const { data, isPending, isError, error, refetch } = useVenues()

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

  if (!data || data.length === 0) {
    return (
      <PagePlaceholder
        icon={Store}
        title="No venues yet"
        description="Venues will appear here once they're added."
      />
    )
  }

  return <VenueList venues={data} selectedVenueId={selectedVenueId} onSelectVenue={onSelectVenue} />
}
