import { useEffect, useState } from 'react'
import { MousePointerClick } from 'lucide-react'
import { useVenue } from '../useVenue'
import { useVenues } from '../useVenues'
import { useUpdateVenue } from '../useUpdateVenue'
import { useValidateVenue } from '../useValidateVenue'
import { useSubmitForReview } from '../useSubmitForReview'
import { useApproveVenue } from '../useApproveVenue'
import { useRejectVenue } from '../useRejectVenue'
import { useMoveVenueToDraft } from '../useMoveVenueToDraft'
import { useArchiveVenue } from '../useArchiveVenue'
import { useRestoreVenue } from '../useRestoreVenue'
import { useDeleteVenue } from '../useDeleteVenue'
import { useUploadVenueMedia } from '../useUploadVenueMedia'
import { useSetCoverFromGallery } from '../useSetCoverFromGallery'
import { useDeleteVenueCoverImage, useDeleteVenueGalleryImage } from '../useDeleteVenueMedia'
import { toVenuePatch, type MediaSlot } from '../api'
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
import { VenueMissingDataChips } from '../../../components/VenueMissingDataChips'
import { evaluateVenueQuality } from '../../../lib/venueQuality'
import { BasicInfoSection } from './sections/BasicInfoSection'
import { TagsCollectionsSection } from './sections/TagsCollectionsSection'
import { BeachDetailsSection } from './sections/BeachDetailsSection'
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
  /** Venue Lifecycle Management — Delete removes the row entirely, so
   * unlike every other transition there's no updated venue to keep
   * displaying afterward. The parent (`pages/Venues.tsx`) owns
   * `selectedVenueId` and clears it here, the same way it already does
   * for "back to list." */
  onDeleted?: () => void
}

export function VenueWorkspace({ venueId, onDirtyChange, onDeleted }: VenueWorkspaceProps) {
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
  const { mutateAsync: rejectVenue, error: rejectError } = useRejectVenue()
  const {
    mutate: moveToDraft,
    isPending: isMovingToDraft,
    error: moveToDraftError,
    reset: resetMoveToDraftError,
  } = useMoveVenueToDraft()
  const {
    mutate: archive,
    isPending: isArchiving,
    error: archiveError,
    reset: resetArchiveError,
  } = useArchiveVenue()
  const {
    mutate: restore,
    isPending: isRestoring,
    error: restoreError,
    reset: resetRestoreError,
  } = useRestoreVenue()
  const { mutateAsync: deleteVenueMutation } = useDeleteVenue()
  const {
    mutate: uploadMedia,
    isPending: isUploadingMedia,
    error: uploadMediaError,
    reset: resetUploadMediaError,
  } = useUploadVenueMedia()
  // A separate mutation instance from `saveDraft` — removing a cover/gallery
  // image acts immediately (see ImagesSection's docstring) and shouldn't
  // share pending/error state with the unrelated Save Draft text-field flow.
  // Reordering (Sprint 26) also reuses this instance — same reasoning:
  // it's a media action, not a text-field save.
  const { mutate: saveMediaPatch, isPending: isSavingMediaPatch, error: mediaPatchError } = useUpdateVenue()
  const {
    mutate: setCoverFromGallery,
    isPending: isSettingCover,
    error: setCoverError,
  } = useSetCoverFromGallery()
  const {
    mutate: deleteCoverImage,
    isPending: isDeletingCover,
    error: deleteCoverError,
  } = useDeleteVenueCoverImage()
  const {
    mutate: deleteGalleryImage,
    isPending: isDeletingGalleryImage,
    error: deleteGalleryImageError,
  } = useDeleteVenueGalleryImage()
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const { role } = useAuth()

  // Brand Asset Propagation — total venues sharing this venue's brand
  // (including itself), for the cover-upload scope prompt. Only queried
  // when a brand is actually set — a brand-less venue never needs this
  // and never shows the prompt (ImagesSection hides it when the count is
  // <= 1 anyway, but skipping the query entirely for the common no-brand
  // case avoids a pointless request on every venue).
  const { data: brandVenues } = useVenues(
    { brand: displayedVenue?.brand ?? undefined, pageSize: 1 },
    { enabled: Boolean(displayedVenue?.brand) },
  )
  const brandVenueCount = brandVenues?.total

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

  // Venue Lifecycle Management — same "only offer what the backend would
  // currently accept, gated on !isDirty since these act on the persisted
  // row" reasoning as canSubmitForReview/canApprove above.
  const canMoveToDraft =
    !isDirty && displayedVenue?.status === 'approved' && hasPermission(role, 'content_approve')
  const canArchive =
    !isDirty && displayedVenue?.status === 'approved' && hasPermission(role, 'content_approve')
  const canRestore =
    !isDirty && displayedVenue?.status === 'archived' && hasPermission(role, 'content_approve')
  // Delete is always available regardless of status (task spec) — the
  // only gate is permission, same tier as delete_destination.
  const canDelete = hasPermission(role, 'content_edit')

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  function handleCancel() {
    resetSaveError()
    resetSubmitForReviewError()
    resetApproveError()
    resetUploadMediaError()
    resetMoveToDraftError()
    resetArchiveError()
    resetRestoreError()
    cancelEditing()
  }

  function handleFieldChange<K extends keyof Venue>(field: K, value: Venue[K]) {
    setValidationResult(null)
    updateField(field, value)
  }

  function handleSave() {
    if (!venueId || !displayedVenue) return
    saveDraft(
      { id: venueId, version: displayedVenue.version, patch: toVenuePatch(displayedVenue) },
      { onSuccess: commitSave },
    )
  }

  function handleReloadAfterConflict() {
    resetSaveError()
    cancelEditing()
    refetch()
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

  async function handleReject(reason: string) {
    if (!venueId) return
    const updatedVenue = await rejectVenue({ id: venueId, reason })
    commitSave(updatedVenue)
  }

  function handleMoveToDraft() {
    if (!venueId) return
    if (!window.confirm('Move this venue back to Draft? It will no longer be visible on the Consumer Website.')) return
    moveToDraft(venueId, { onSuccess: commitSave })
  }

  function handleArchive() {
    if (!venueId) return
    if (!window.confirm('Archive this venue? It will no longer be visible on the Consumer Website, but stays editable here.')) return
    archive(venueId, { onSuccess: commitSave })
  }

  function handleRestore() {
    if (!venueId) return
    restore(venueId, { onSuccess: commitSave })
  }

  async function handleDelete() {
    if (!venueId) return
    await deleteVenueMutation(venueId)
    onDeleted?.()
  }

  function handleUpload(file: File, slot: MediaSlot, applyToBrand = false) {
    if (!venueId) return
    setUploadProgress(0)
    uploadMedia(
      { id: venueId, file, slot, onProgress: setUploadProgress, applyToBrand },
      { onSuccess: commitSave, onSettled: () => setUploadProgress(null) },
    )
  }

  function handleRemoveCover() {
    if (!venueId) return
    deleteCoverImage(venueId, { onSuccess: commitSave })
  }

  function handleRemoveGalleryImage(url: string) {
    if (!venueId) return
    deleteGalleryImage({ id: venueId, url }, { onSuccess: commitSave })
  }

  function handleReorderGallery(newOrder: string[]) {
    if (!venueId || !displayedVenue) return
    saveMediaPatch(
      {
        id: venueId,
        version: displayedVenue.version,
        patch: { ...toVenuePatch(displayedVenue), gallery_image_urls: newOrder },
      },
      { onSuccess: commitSave },
    )
  }

  function handleSetCover(url: string) {
    if (!venueId) return
    setCoverFromGallery({ id: venueId, url }, { onSuccess: commitSave })
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

  const isSaveConflict = saveError instanceof ApiError && saveError.status === 409

  return (
    <div className="flex flex-col gap-4 pb-24 lg:pb-0">
      {isSaveConflict && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>{saveError.message}</span>
          <button
            type="button"
            onClick={handleReloadAfterConflict}
            className="shrink-0 rounded-lg border border-amber-400 px-3 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
          >
            Reload
          </button>
        </div>
      )}
      {/* Phone/tablet: fixed to the bottom, safe-area aware, so the
          primary Edit/Save/workflow actions are always one thumb-reach
          away, "native mobile editor" style (requirement 6). Desktop
          (`lg:`): `lg:static` restores its original in-flow position at
          the top, unchanged. */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-gray-200 bg-white p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] shadow-[0_-4px_12px_rgba(0,0,0,0.06)] lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
        <WorkspaceToolbar
          venueName={displayedVenue.name}
          mode={mode}
          isDirty={isDirty}
          isSaving={isSaving}
          saveError={
            isSaveConflict
              ? null
              : saveError instanceof ApiError
                ? saveError.message
                : saveError
                  ? 'Failed to save.'
                  : null
          }
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
          canReject={canApprove}
          rejectError={
            rejectError instanceof ApiError ? rejectError.message : rejectError ? 'Failed to reject.' : null
          }
          canMoveToDraft={canMoveToDraft}
          isMovingToDraft={isMovingToDraft}
          moveToDraftError={
            moveToDraftError instanceof ApiError
              ? moveToDraftError.message
              : moveToDraftError
                ? 'Failed to move to draft.'
                : null
          }
          canArchive={canArchive}
          isArchiving={isArchiving}
          archiveError={
            archiveError instanceof ApiError ? archiveError.message : archiveError ? 'Failed to archive.' : null
          }
          canRestore={canRestore}
          isRestoring={isRestoring}
          restoreError={
            restoreError instanceof ApiError ? restoreError.message : restoreError ? 'Failed to restore.' : null
          }
          canDelete={canDelete}
          onReject={handleReject}
          onEdit={startEditing}
          onCancel={handleCancel}
          onSave={handleSave}
          onValidate={handleValidate}
          onSubmitForReview={handleSubmitForReview}
          onApprove={handleApprove}
          onMoveToDraft={handleMoveToDraft}
          onArchive={handleArchive}
          onRestore={handleRestore}
          onDelete={handleDelete}
        />
      </div>
      <VenueMissingDataChips quality={evaluateVenueQuality(displayedVenue)} />
      {validationResult && <ValidationSummary result={validationResult} />}
      <BasicInfoSection venue={displayedVenue} mode={mode} onFieldChange={handleFieldChange} errors={fieldErrors} />
      <TagsCollectionsSection venue={displayedVenue} onSaved={commitSave} />
      {displayedVenue.category === 'Beach' && (
        <BeachDetailsSection venue={displayedVenue} mode={mode} onFieldChange={handleFieldChange} />
      )}
      <LocationSection venue={displayedVenue} mode={mode} onFieldChange={handleFieldChange} errors={fieldErrors} />
      <ContactSection venue={displayedVenue} mode={mode} onFieldChange={handleFieldChange} errors={fieldErrors} />
      <OpeningHoursSection venue={displayedVenue} />
      <ImagesSection
        venue={displayedVenue}
        mode={mode}
        brandVenueCount={brandVenueCount}
        onUploadCover={(file, applyToBrand) => handleUpload(file, 'cover', applyToBrand)}
        onUploadGalleryImage={(file) => handleUpload(file, 'gallery')}
        onRemoveCover={handleRemoveCover}
        onRemoveGalleryImage={handleRemoveGalleryImage}
        onSetCover={handleSetCover}
        onReorderGallery={handleReorderGallery}
        isUploading={
          isUploadingMedia || isSavingMediaPatch || isSettingCover || isDeletingCover || isDeletingGalleryImage
        }
        uploadProgress={uploadProgress}
        uploadError={
          uploadMediaError instanceof ApiError
            ? uploadMediaError.message
            : mediaPatchError instanceof ApiError
              ? mediaPatchError.message
              : setCoverError instanceof ApiError
                ? setCoverError.message
                : deleteCoverError instanceof ApiError
                  ? deleteCoverError.message
                  : deleteGalleryImageError instanceof ApiError
                    ? deleteGalleryImageError.message
                    : uploadMediaError ||
                        mediaPatchError ||
                        setCoverError ||
                        deleteCoverError ||
                        deleteGalleryImageError
                      ? 'Failed to update images.'
                      : null
        }
      />
      <PublishingStatusSection
        venue={displayedVenue}
        mode={mode}
        onFieldChange={handleFieldChange}
        errors={fieldErrors}
      />
    </div>
  )
}
