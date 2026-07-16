import { useEffect } from 'react'
import { MousePointerClick } from 'lucide-react'
import { useVenue } from '../useVenue'
import { useUpdateVenue } from '../useUpdateVenue'
import { toVenuePatch } from '../api'
import { ApiError } from '../../../lib/apiClient'
import { useDraft } from '../../../hooks/useDraft'
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

type VenueWorkspaceProps = {
  venueId: string | null
  onDirtyChange?: (isDirty: boolean) => void
}

export function VenueWorkspace({ venueId, onDirtyChange }: VenueWorkspaceProps) {
  const { data: venue, isPending, isError, error, refetch } = useVenue(venueId)
  const {
    mode,
    value: displayedVenue,
    isDirty,
    startEditing,
    cancelEditing,
    commitSave,
    updateField,
  } = useDraft<Venue>(venue, venueId)
  const { mutate: saveDraft, isPending: isSaving, error: saveError, reset: resetSaveError } = useUpdateVenue()

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  function handleCancel() {
    resetSaveError()
    cancelEditing()
  }

  function handleSave() {
    if (!venueId || !displayedVenue) return
    saveDraft(
      { id: venueId, patch: toVenuePatch(displayedVenue) },
      { onSuccess: commitSave },
    )
  }

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

  if (!displayedVenue) {
    return null
  }

  return (
    <div className="flex flex-col gap-4">
      <WorkspaceToolbar
        venueName={displayedVenue.name}
        mode={mode}
        isDirty={isDirty}
        isSaving={isSaving}
        saveError={saveError instanceof ApiError ? saveError.message : saveError ? 'Failed to save.' : null}
        onEdit={startEditing}
        onCancel={handleCancel}
        onSave={handleSave}
      />
      <BasicInfoSection venue={displayedVenue} mode={mode} onFieldChange={updateField} />
      <LocationSection venue={displayedVenue} mode={mode} onFieldChange={updateField} />
      <ContactSection venue={displayedVenue} mode={mode} onFieldChange={updateField} />
      <OpeningHoursSection venue={displayedVenue} />
      <ImagesSection venue={displayedVenue} />
      <PublishingStatusSection venue={displayedVenue} mode={mode} onFieldChange={updateField} />
    </div>
  )
}
