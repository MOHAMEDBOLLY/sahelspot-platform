import { MapPin } from 'lucide-react'
import { useDestinations } from './useDestinations'
import { DestinationList } from './DestinationList'
import { LoadingState } from '../../components/LoadingState'
import { ErrorState } from '../../components/ErrorState'
import { PagePlaceholder } from '../../components/PagePlaceholder'

type DestinationListPanelProps = {
  selectedDestinationId: string | null
  onSelectDestination: (id: string) => void
}

export function DestinationListPanel({ selectedDestinationId, onSelectDestination }: DestinationListPanelProps) {
  const { data, isPending, isError, error, refetch } = useDestinations()

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

  if (!data || data.length === 0) {
    return (
      <PagePlaceholder
        icon={MapPin}
        title="No destinations yet"
        description="Destinations will appear here once they're added."
      />
    )
  }

  return (
    <DestinationList
      destinations={data}
      selectedDestinationId={selectedDestinationId}
      onSelectDestination={onSelectDestination}
    />
  )
}
