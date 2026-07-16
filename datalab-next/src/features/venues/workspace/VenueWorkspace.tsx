import { useEffect, useState } from 'react'
import { MousePointerClick } from 'lucide-react'
import { useVenue } from '../useVenue'
import { LoadingState } from '../../../components/LoadingState'
import { ErrorState } from '../../../components/ErrorState'
import { PagePlaceholder } from '../../../components/PagePlaceholder'
import { WorkspaceToolbar } from './WorkspaceToolbar'
import { BasicInfoSection } from './sections/BasicInfoSection'
import { LocationSection } from './sections/LocationSection'
import { ContactSection } from './sections/ContactSection'
import { OpeningHoursSection } from './sections/OpeningHoursSection'
import { ImagesSection } from './sections/ImagesSection'
import { PublishingStatusSection } from './sections/PublishingStatusSection'
import type { Venue } from '../../../types/venue'
import type { WorkspaceMode } from './types'

type VenueWorkspaceProps = {
  venueId: string | null
}

export function VenueWorkspace({ venueId }: VenueWorkspaceProps) {
  const { data: venue, isPending, isError, error, refetch } = useVenue(venueId)

  const [mode, setMode] = useState<WorkspaceMode>('view')
  const [draft, setDraft] = useState<Venue | null>(null)

  // Switching venues while editing should not carry a half-edited draft onto
  // the newly selected venue — drop back to view mode.
  useEffect(() => {
    setMode('view')
    setDraft(null)
  }, [venueId])

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

  const handleEdit = () => {
    setDraft(venue)
    setMode('edit')
  }

  const handleCancel = () => {
    setDraft(null)
    setMode('view')
  }

  const handleFieldChange = <K extends keyof Venue>(field: K, value: Venue[K]) => {
    setDraft((current) => (current ? { ...current, [field]: value } : current))
  }

  // View mode always shows the fetched venue; edit mode shows the in-progress
  // draft, which starts as a copy of it. Nothing here reaches the API.
  const displayedVenue = mode === 'edit' && draft ? draft : venue

  return (
    <div className="flex flex-col gap-4">
      <WorkspaceToolbar
        venueName={displayedVenue.name}
        mode={mode}
        onEdit={handleEdit}
        onCancel={handleCancel}
      />
      <BasicInfoSection venue={displayedVenue} mode={mode} onFieldChange={handleFieldChange} />
      <LocationSection venue={displayedVenue} mode={mode} onFieldChange={handleFieldChange} />
      <ContactSection venue={displayedVenue} mode={mode} onFieldChange={handleFieldChange} />
      <OpeningHoursSection venue={displayedVenue} />
      <ImagesSection venue={displayedVenue} />
      <PublishingStatusSection venue={displayedVenue} mode={mode} onFieldChange={handleFieldChange} />
    </div>
  )
}
