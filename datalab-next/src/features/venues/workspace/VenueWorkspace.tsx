import { useEffect, useState } from 'react'
import { MousePointerClick } from 'lucide-react'
import { useVenue } from '../useVenue'
import { useUpdateVenue } from '../useUpdateVenue'
import { useValidateVenue } from '../useValidateVenue'
import { toVenuePatch } from '../api'
import { validateVenueDraft } from '../venueValidation'
import { ApiError } from '../../../lib/apiClient'
import { useDraft } from '../../../hooks/useDraft'
import { LoadingState } from '../../../components/LoadingState'
import { ErrorState } from '../../../components/ErrorState'
import { PagePlaceholder } from '../../../components/PagePlaceholder'
import { WorkspaceToolbar } from './WorkspaceToolbar'
import { ValidationSummary } from './ValidationSummary'
import { BasicInfoSection } from './sections/BasicInfoSection'
import { LocationSection } from './sections/LocationSection'
import { ContactSection } from './sections/ContactSection'
import { OpeningHoursSection } from './sections/OpeningHoursSection'
import { ImagesSection } from './sections/ImagesSection'
import { PublishingStatusSection } from './sections/PublishingStatusSection'
import type { Venue } from '../../../types/venue'
import type { ValidationResult } from '../../../types/validation'

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
  const { mutate: runValidate, isPending: isValidating } = useValidateVenue()
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)

  // A stale validation result belongs to whatever the venue looked like when
  // it ran — never carry it across venues, or across a fresh edit session.
  useEffect(() => {
    setValidationResult(null)
  }, [venueId])

  const fieldErrors = mode === 'edit' && displayedVenue ? validateVenueDraft(displayedVenue) : {}
  const hasFieldErrors = Object.keys(fieldErrors).length > 0

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  function handleCancel() {
    resetSaveError()
    cancelEditing()
  }

  function handleFieldChange<K extends keyof Venue>(field: K, value: Venue[K]) {
    setValidationResult(null)
    updateField(field, value)
  }

  function handleSave() {
    if (!venueId || !displayedVenue) return
    saveDraft(
      { id: venueId, patch: toVenuePatch(displayedVenue) },
      { onSuccess: commitSave },
    )
  }

  function handleValidate() {
    if (!venueId) return
    runValidate(venueId, { onSuccess: setValidationResult })
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
        hasFieldErrors={hasFieldErrors}
        isValidating={isValidating}
        onEdit={startEditing}
        onCancel={handleCancel}
        onSave={handleSave}
        onValidate={handleValidate}
      />
      {validationResult && <ValidationSummary result={validationResult} />}
      <BasicInfoSection venue={displayedVenue} mode={mode} onFieldChange={handleFieldChange} errors={fieldErrors} />
      <LocationSection venue={displayedVenue} mode={mode} onFieldChange={handleFieldChange} errors={fieldErrors} />
      <ContactSection venue={displayedVenue} mode={mode} onFieldChange={handleFieldChange} errors={fieldErrors} />
      <OpeningHoursSection venue={displayedVenue} />
      <ImagesSection venue={displayedVenue} />
      <PublishingStatusSection
        venue={displayedVenue}
        mode={mode}
        onFieldChange={handleFieldChange}
        errors={fieldErrors}
      />
    </div>
  )
}
