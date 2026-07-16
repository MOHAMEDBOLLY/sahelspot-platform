import { MousePointerClick } from 'lucide-react'
import { useVenue } from '../useVenue'
import { LoadingState } from '../../../components/LoadingState'
import { ErrorState } from '../../../components/ErrorState'
import { PagePlaceholder } from '../../../components/PagePlaceholder'
import { BasicInfoSection } from './sections/BasicInfoSection'
import { LocationSection } from './sections/LocationSection'
import { ContactSection } from './sections/ContactSection'
import { OpeningHoursSection } from './sections/OpeningHoursSection'
import { ImagesSection } from './sections/ImagesSection'
import { PublishingStatusSection } from './sections/PublishingStatusSection'

type VenueWorkspaceProps = {
  venueId: string | null
}

export function VenueWorkspace({ venueId }: VenueWorkspaceProps) {
  const { data: venue, isPending, isError, error, refetch } = useVenue(venueId)

  if (!venueId) {
    return (
      <PagePlaceholder
        icon={MousePointerClick}
        title="No venue selected"
        description="Select a venue from the list to view its details."
      />
    )
  }

  if (isPending) {
    return <LoadingState label="Loading venue…" />
  }

  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'Failed to load venue.'}
        onRetry={() => refetch()}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <BasicInfoSection venue={venue} />
      <LocationSection venue={venue} />
      <ContactSection venue={venue} />
      <OpeningHoursSection venue={venue} />
      <ImagesSection venue={venue} />
      <PublishingStatusSection venue={venue} />
    </div>
  )
}
