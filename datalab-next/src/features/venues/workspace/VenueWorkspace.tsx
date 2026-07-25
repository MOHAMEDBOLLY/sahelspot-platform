import { useEffect, useState } from 'react'
import { MousePointerClick } from 'lucide-react'
import { useVenue } from '../useVenue'
import { useUpdateVenue } from '../useUpdateVenue'
import { useValidateVenue } from '../useValidateVenue'
import { useSubmitForReview } from '../useSubmitForReview'
import { useApproveVenue } from '../useApproveVenue'
import { toVenuePatch } from '../api'
import { validateVenueDraft } from '../venueValidation'
import { ApiError } from '../../../lib/apiClient'
import { useDraft } from '../../../hooks/useDraft'
import { useAuth } from '../../auth/useAuth'
import { hasPermission } from '../../auth/permissions'
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
  const {
    mutate: submitForReview,
    isPending: isSubmittingForReview,
    error: submitForReviewError,
    reset: resetSubmitForReviewError,
  } = useSubmitForReview()
  const {
    mutate: approve,
    isPending: isApproving,
    error: approveError,
    reset: resetApproveError,
  } = useApproveVenue()
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const { role } = useAuth()

  // A stale validation result belongs to whatever the venue looked like when
  // it ran — never carry it across venues, or across a fresh edit session.
  useEffect(() => {
    setValidationResult(null)
  }, [venueId])

  const fieldErrors = mode === 'edit' && displayedVenue ? validateVenueDraft(displayedVenue) : {}
  const hasFieldErrors = Object.keys(fieldErrors).length > 0

  // Sprint 24 — the backend requires `content_edit` for both Save Draft
  // and Validate, so one permission check covers Edit/Save Draft (via
  // DraftToolbar's `canEdit`) and Validate's visibility.
  const canEdit = hasPermission(role, 'content_edit')

  // Review is only offerable once someone has actually run Validate and it
  // came back ready — not derived independently, so this can never drift
  // from what the backend's Editorial Readiness check just said. Also
  // requires !isDirty, same reasoning as Validate itself: the persisted row
  // (what Review would act on) must match what's on screen. Sprint 24 adds
  // the permission check — same "never render what the backend would 403"
  // reasoning as `canEdit` above.
  const canSubmitForReview =
    !isDirty &&
    displayedVenue?.status === 'draft' &&
    validationResult?.ready_for_review === true &&
    hasPermission(role, 'content_submit_review')

  // Approval is a human editorial decision, not a re-run of Validate — it
  // only depends on the venue's current status, never on validationResult.
  // Still requires !isDirty for the same reason Review does: Approval acts
  // on the persisted row, so it shouldn't be offered while what's on screen
  // might not match it.
  const canApprove = !isDirty && displayedVenue?.status === 'review' && hasPermission(role, 'content_approve')

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  function handleCancel() {
    resetSaveError()
    resetSubmitForReviewError()
    resetApproveError()
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

  function handleSubmitForReview() {
    if (!venueId) return
    submitForReview(venueId, {
      onSuccess: (updatedVenue) => {
        commitSave(updatedVenue)
        setValidationResult(null)
      },
    })
  }

  function handleApprove() {
    if (!venueId) return
    approve(venueId, { onSuccess: commitSave })
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
        canEdit={canEdit}
        isValidating={isValidating}
        canSubmitForReview={canSubmitForReview}
        isSubmittingForReview={isSubmittingForReview}
        submitForReviewError={
          submitForReviewError instanceof ApiError
            ? submitForReviewError.message
            : submitForReviewError
              ? 'Failed to submit for review.'
              : null
        }
        canApprove={canApprove}
        isApproving={isApproving}
        approveError={
          approveError instanceof ApiError ? approveError.message : approveError ? 'Failed to approve.' : null
        }
        onEdit={startEditing}
        onCancel={handleCancel}
        onSave={handleSave}
        onValidate={handleValidate}
        onSubmitForReview={handleSubmitForReview}
        onApprove={handleApprove}
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
