import { Store } from 'lucide-react'
import { useVenues } from '../features/venues/useVenues'
import { VenueTable } from '../features/venues/VenueTable'
import { LoadingState } from '../components/LoadingState'
import { ErrorState } from '../components/ErrorState'
import { PagePlaceholder } from '../components/PagePlaceholder'

export function Venues() {
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

  return <VenueTable venues={data} />
}
