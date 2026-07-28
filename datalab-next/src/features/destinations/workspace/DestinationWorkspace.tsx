import { useEffect, useState } from 'react'
import { MapPinOff, Trash2 } from 'lucide-react'
import { useDestination } from '../useDestination'
import { useUpdateDestination } from '../useUpdateDestination'
import { useDeleteDestination } from '../useDeleteDestination'
import { useRejectDestination } from '../useRejectDestination'
import { useUploadDestinationCover } from '../useUploadDestinationCover'
import { toDestinationPatch } from '../api'
import { validateDestinationDraft } from '../destinationValidation'
import { ApiError } from '../../../lib/apiClient'
import { useDraft } from '../../../hooks/useDraft'
import { LoadingState } from '../../../components/LoadingState'
import { ErrorState } from '../../../components/ErrorState'
import { PagePlaceholder } from '../../../components/PagePlaceholder'
import { DraftToolbar } from '../../../components/workspace/DraftToolbar'
import { RejectDialog } from '../../../components/RejectDialog'
import { useAuth } from '../../auth/useAuth'
import { hasPermission } from '../../auth/permissions'
import { BasicInfoSection } from './sections/BasicInfoSection'
import { CoverImageSection } from './sections/CoverImageSection'
import { PublishingStatusSection } from './sections/PublishingStatusSection'
import type { Destination } from '../../../types/destination'

type DestinationWorkspaceProps = {
  destinationId: string | null
  onDirtyChange?: (isDirty: boolean) => void
  /** Sprint 29 — called after a successful delete, so the parent page can
   * clear its selection (the deleted destination no longer exists to show). */
  onDeleted?: () => void
}

/**
 * The Destination Workspace — Sprint 21's proof that the editorial
 * architecture Sprints 9–12 built for Venues (Edit Mode, `useDraft`,
 * Save Draft, frontend UX validation) generalizes to a second entity
 * without forking it. Deliberately simpler than `VenueWorkspace`: no
 * Validate/Submit for Review/Approve, since no Editorial Readiness or
 * workflow endpoints exist for destinations yet (out of scope) — so this
 * uses `DraftToolbar` directly, with no entity-specific wrapper toolbar
 * the way Venue's `WorkspaceToolbar` needs one. Sprint 29 adds Delete
 * (via `DraftToolbar`'s existing `extraActions` slot — the same
 * extension point Venue's toolbar already uses, not a new one) and a
 * cover image section.
 */
export function DestinationWorkspace({ destinationId, onDirtyChange, onDeleted }: DestinationWorkspaceProps) {
  const { data: destination, isPending, isError, error, refetch } = useDestination(destinationId)
  const {
    mode,
    value: displayedDestination,
    isDirty,
    startEditing,
    cancelEditing,
    commitSave,
    updateField,
  } = useDraft<Destination>(destination, destinationId)
  const { mutate: saveDraft, isPending: isSaving, error: saveError, reset: resetSaveError } =
    useUpdateDestination()
  const { mutate: deleteDestination, isPending: isDeleting, error: deleteError } = useDeleteDestination()
  const { mutateAsync: rejectDestination, error: rejectError } = useRejectDestination()
  const {
    mutate: uploadCover,
    isPending: isUploadingCover,
    error: uploadCoverError,
    reset: resetUploadCoverError,
  } = useUploadDestinationCover()
  const { mutate: saveCoverPatch, isPending: isSavingCoverPatch, error: coverPatchError } =
    useUpdateDestination()
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const { role } = useAuth()
  const canEdit = hasPermission(role, 'content_edit')
  const canReject = !isDirty && displayedDestination?.status === 'review' && hasPermission(role, 'content_approve')

  const fieldErrors =
    mode === 'edit' && displayedDestination ? validateDestinationDraft(displayedDestination) : {}
  const hasFieldErrors = Object.keys(fieldErrors).length > 0

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  function handleCancel() {
    resetSaveError()
    cancelEditing()
  }

  function handleFieldChange<K extends keyof Destination>(field: K, value: Destination[K]) {
    updateField(field, value)
  }

  function handleSave() {
    if (!destinationId || !displayedDestination) return
    saveDraft(
      { id: destinationId, version: displayedDestination.version, patch: toDestinationPatch(displayedDestination) },
      { onSuccess: commitSave },
    )
  }

  function handleReloadAfterConflict() {
    resetSaveError()
    cancelEditing()
    refetch()
  }

  function handleDelete() {
    if (!destinationId || !displayedDestination) return
    if (
      !window.confirm(
        `Delete "${displayedDestination.name}"? This cannot be undone. Destinations that still have venues can't be deleted.`,
      )
    ) {
      return
    }
    deleteDestination(destinationId, { onSuccess: () => onDeleted?.() })
  }

  async function handleReject(reason: string) {
    if (!destinationId) return
    const updatedDestination = await rejectDestination({ id: destinationId, reason })
    commitSave(updatedDestination)
  }

  function handleUploadCover(file: File) {
    if (!destinationId) return
    resetUploadCoverError()
    setUploadProgress(0)
    uploadCover(
      { id: destinationId, file, onProgress: setUploadProgress },
      { onSuccess: commitSave, onSettled: () => setUploadProgress(null) },
    )
  }

  function handleRemoveCover() {
    if (!destinationId || !displayedDestination) return
    saveCoverPatch(
      {
        id: destinationId,
        version: displayedDestination.version,
        patch: { ...toDestinationPatch(displayedDestination), cover_image_url: null },
      },
      { onSuccess: commitSave },
    )
  }

  if (!destinationId) {
    return (
      <PagePlaceholder
        icon={MapPinOff}
        title="No destination selected"
        description="Select a destination from the list to view its details."
      />
    )
  }

  if (isPending) {
    return <LoadingState label="Loading destination…" />
  }

  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'Failed to load destination.'}
        onRetry={() => refetch()}
      />
    )
  }

  if (!displayedDestination) {
    return null
  }

  const isSaveConflict = saveError instanceof ApiError && saveError.status === 409

  return (
    <div className="flex flex-col gap-4">
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
      <DraftToolbar
        title={displayedDestination.name}
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
        onEdit={startEditing}
        onCancel={handleCancel}
        onSave={handleSave}
        extraActions={
          <>
            {canEdit && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting || mode === 'edit'}
                title={mode === 'edit' ? 'Cancel editing before deleting.' : 'Delete destination'}
                className="flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 size={14} />
                {isDeleting ? 'Deleting…' : 'Delete'}
              </button>
            )}
            {canReject && <RejectDialog onReject={handleReject} />}
          </>
        }
        extraStatus={
          <>
            {deleteError && (
              <span
                className="truncate text-xs font-medium text-red-600"
                title={deleteError instanceof ApiError ? deleteError.message : 'Failed to delete.'}
              >
                {deleteError instanceof ApiError ? deleteError.message : 'Failed to delete.'}
              </span>
            )}
            {rejectError && (
              <span
                className="truncate text-xs font-medium text-red-600"
                title={rejectError instanceof ApiError ? rejectError.message : 'Failed to reject.'}
              >
                {rejectError instanceof ApiError ? rejectError.message : 'Failed to reject.'}
              </span>
            )}
          </>
        }
      />
      <BasicInfoSection
        destination={displayedDestination}
        mode={mode}
        onFieldChange={handleFieldChange}
        errors={fieldErrors}
      />
      <CoverImageSection
        destination={displayedDestination}
        mode={mode}
        onUploadCover={handleUploadCover}
        onRemoveCover={handleRemoveCover}
        isUploading={isUploadingCover || isSavingCoverPatch}
        uploadProgress={uploadProgress}
        uploadError={
          uploadCoverError instanceof ApiError
            ? uploadCoverError.message
            : coverPatchError instanceof ApiError
              ? coverPatchError.message
              : uploadCoverError || coverPatchError
                ? 'Failed to update cover image.'
                : null
        }
      />
      <PublishingStatusSection destination={displayedDestination} />
    </div>
  )
}
