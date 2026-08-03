import { useEffect, useState } from 'react'
import { Archive, ArchiveRestore, CalendarOff, Loader2, RotateCcw, Send, ThumbsUp } from 'lucide-react'
import { useEvent } from '../useEvent'
import { useUpdateEvent } from '../useUpdateEvent'
import { useDeleteEvent } from '../useDeleteEvent'
import { useRejectEvent } from '../useRejectEvent'
import { useSubmitEventForReview } from '../useSubmitEventForReview'
import { useApproveEvent } from '../useApproveEvent'
import { useMoveEventToDraft } from '../useMoveEventToDraft'
import { useArchiveEvent } from '../useArchiveEvent'
import { useRestoreEvent } from '../useRestoreEvent'
import { useUploadEventCover } from '../useUploadEventCover'
import { useDeleteEventCover } from '../useDeleteEventCover'
import { toEventPatch } from '../api'
import { ApiError } from '../../../lib/apiClient'
import { useDraft } from '../../../hooks/useDraft'
import { useAuth } from '../../auth/useAuth'
import { hasPermission } from '../../auth/permissions'
import { LoadingState } from '../../../components/LoadingState'
import { ErrorState } from '../../../components/ErrorState'
import { PagePlaceholder } from '../../../components/PagePlaceholder'
import { DraftToolbar } from '../../../components/workspace/DraftToolbar'
import { RejectDialog } from '../../../components/RejectDialog'
import { DeleteConfirmDialog } from '../../../components/DeleteConfirmDialog'
import { EventBasicInfoSection } from './sections/EventBasicInfoSection'
import { EventTicketingSection } from './sections/EventTicketingSection'
import { EventCoverSection } from './sections/EventCoverSection'
import { EventPublishingStatusSection } from './sections/EventPublishingStatusSection'
import type { Event } from '../../../types/event'

type EventWorkspaceProps = {
  eventId: string | null
  onDirtyChange?: (isDirty: boolean) => void
  onDeleted?: () => void
}

/** Events Module v1 — the same editorial architecture Venues/Destinations
 * already established: `useDraft` for Edit Mode/dirty-tracking, `DraftToolbar`
 * for the generic Edit/Save/workflow shell (its `extraActions`/`extraStatus`
 * slots, the same extension point every entity's workspace already uses —
 * no new toolbar component). Adds the full Venue Lifecycle Management set
 * (Move to Draft / Archive / Restore, alongside the draft -> review ->
 * approved workflow every entity already has) since Events v1 explicitly
 * needs all of Draft/Review/Approve/Archive/Restore, not just the first two.
 */
export function EventWorkspace({ eventId, onDirtyChange, onDeleted }: EventWorkspaceProps) {
  const { data: event, isPending, isError, error, refetch } = useEvent(eventId)
  const {
    mode,
    value: displayedEvent,
    isDirty,
    startEditing,
    cancelEditing,
    commitSave,
    updateField,
  } = useDraft<Event>(event, eventId)
  const { mutate: saveDraft, isPending: isSaving, error: saveError, reset: resetSaveError } = useUpdateEvent()
  const { mutate: deleteEventMutation } = useDeleteEvent()
  const { mutateAsync: rejectEvent, error: rejectError } = useRejectEvent()
  const {
    mutate: submitForReview,
    isPending: isSubmittingForReview,
    error: submitForReviewError,
  } = useSubmitEventForReview()
  const { mutate: approve, isPending: isApproving, error: approveError } = useApproveEvent()
  const { mutate: moveToDraft, isPending: isMovingToDraft, error: moveToDraftError } = useMoveEventToDraft()
  const { mutate: archive, isPending: isArchiving, error: archiveError } = useArchiveEvent()
  const { mutate: restore, isPending: isRestoring, error: restoreError } = useRestoreEvent()
  const {
    mutate: uploadCover,
    isPending: isUploadingCover,
    error: uploadCoverError,
    reset: resetUploadCoverError,
  } = useUploadEventCover()
  const { mutate: removeCover, isPending: isRemovingCover, error: removeCoverError } = useDeleteEventCover()
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const { role } = useAuth()

  const canEdit = hasPermission(role, 'content_edit')
  const canSubmitForReview =
    !isDirty && displayedEvent?.status === 'draft' && hasPermission(role, 'content_submit_review')
  const canApprove = !isDirty && displayedEvent?.status === 'review' && hasPermission(role, 'content_approve')
  const canReject = canApprove
  const canMoveToDraft = !isDirty && displayedEvent?.status === 'approved' && hasPermission(role, 'content_approve')
  const canArchive = !isDirty && displayedEvent?.status === 'approved' && hasPermission(role, 'content_approve')
  const canRestore = !isDirty && displayedEvent?.status === 'archived' && hasPermission(role, 'content_approve')
  const canDelete = hasPermission(role, 'content_edit')

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  function handleCancel() {
    resetSaveError()
    cancelEditing()
  }

  function handleFieldChange<K extends keyof Event>(field: K, value: Event[K]) {
    updateField(field, value)
  }

  function handleSave() {
    if (!eventId || !displayedEvent) return
    saveDraft(
      { id: eventId, version: displayedEvent.version, patch: toEventPatch(displayedEvent) },
      { onSuccess: commitSave },
    )
  }

  function handleReloadAfterConflict() {
    resetSaveError()
    cancelEditing()
    refetch()
  }

  async function handleDelete() {
    if (!eventId) return
    await new Promise<void>((resolve, reject) => {
      deleteEventMutation(eventId, {
        onSuccess: () => {
          onDeleted?.()
          resolve()
        },
        onError: reject,
      })
    })
  }

  async function handleReject(reason: string) {
    if (!eventId) return
    const updated = await rejectEvent({ id: eventId, reason })
    commitSave(updated)
  }

  function handleSubmitForReview() {
    if (!eventId) return
    submitForReview(eventId, { onSuccess: commitSave })
  }

  function handleApprove() {
    if (!eventId) return
    approve(eventId, { onSuccess: commitSave })
  }

  function handleMoveToDraft() {
    if (!eventId) return
    if (!window.confirm('Move this event back to Draft? It will no longer be visible on the Consumer Website.')) return
    moveToDraft(eventId, { onSuccess: commitSave })
  }

  function handleArchive() {
    if (!eventId) return
    if (!window.confirm('Archive this event? It will no longer be visible on the Consumer Website, but stays editable here.')) return
    archive(eventId, { onSuccess: commitSave })
  }

  function handleRestore() {
    if (!eventId) return
    restore(eventId, { onSuccess: commitSave })
  }

  function handleUploadCover(file: File) {
    if (!eventId) return
    resetUploadCoverError()
    setUploadProgress(0)
    uploadCover(
      { id: eventId, file, onProgress: setUploadProgress },
      { onSuccess: commitSave, onSettled: () => setUploadProgress(null) },
    )
  }

  function handleRemoveCover() {
    if (!eventId) return
    removeCover(eventId, { onSuccess: commitSave })
  }

  if (!eventId) {
    return (
      <PagePlaceholder
        icon={CalendarOff}
        title="No event selected"
        description="Select an event from the list to view its details."
      />
    )
  }

  if (isPending) {
    return <LoadingState label="Loading event…" />
  }

  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'Failed to load event.'}
        onRetry={() => refetch()}
      />
    )
  }

  if (!displayedEvent) {
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
        title={displayedEvent.title}
        mode={mode}
        isDirty={isDirty}
        isSaving={isSaving}
        saveError={
          isSaveConflict ? null : saveError instanceof ApiError ? saveError.message : saveError ? 'Failed to save.' : null
        }
        hasFieldErrors={false}
        canEdit={canEdit}
        onEdit={startEditing}
        onCancel={handleCancel}
        onSave={handleSave}
        extraActions={
          <>
            {canSubmitForReview && (
              <button
                type="button"
                onClick={handleSubmitForReview}
                disabled={isSubmittingForReview}
                className="flex items-center gap-1.5 rounded-lg bg-green-700 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmittingForReview ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {isSubmittingForReview ? 'Submitting…' : 'Submit for Review'}
              </button>
            )}
            {canApprove && (
              <button
                type="button"
                onClick={handleApprove}
                disabled={isApproving}
                className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isApproving ? <Loader2 size={14} className="animate-spin" /> : <ThumbsUp size={14} />}
                {isApproving ? 'Approving…' : 'Approve'}
              </button>
            )}
            {canReject && <RejectDialog onReject={handleReject} />}
            {canMoveToDraft && (
              <button
                type="button"
                onClick={handleMoveToDraft}
                disabled={isMovingToDraft}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isMovingToDraft ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                {isMovingToDraft ? 'Moving to Draft…' : 'Move to Draft'}
              </button>
            )}
            {canArchive && (
              <button
                type="button"
                onClick={handleArchive}
                disabled={isArchiving}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isArchiving ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
                {isArchiving ? 'Archiving…' : 'Archive'}
              </button>
            )}
            {canRestore && (
              <button
                type="button"
                onClick={handleRestore}
                disabled={isRestoring}
                className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isRestoring ? <Loader2 size={14} className="animate-spin" /> : <ArchiveRestore size={14} />}
                {isRestoring ? 'Restoring…' : 'Restore'}
              </button>
            )}
            {canDelete && <DeleteConfirmDialog onConfirm={handleDelete} entityLabel="Event" />}
          </>
        }
        extraStatus={
          <>
            {submitForReviewError && (
              <span className="truncate text-xs font-medium text-red-600">
                {submitForReviewError instanceof ApiError ? submitForReviewError.message : 'Failed to submit for review.'}
              </span>
            )}
            {approveError && (
              <span className="truncate text-xs font-medium text-red-600">
                {approveError instanceof ApiError ? approveError.message : 'Failed to approve.'}
              </span>
            )}
            {rejectError && (
              <span className="truncate text-xs font-medium text-red-600">
                {rejectError instanceof ApiError ? rejectError.message : 'Failed to reject.'}
              </span>
            )}
            {moveToDraftError && (
              <span className="truncate text-xs font-medium text-red-600">
                {moveToDraftError instanceof ApiError ? moveToDraftError.message : 'Failed to move to draft.'}
              </span>
            )}
            {archiveError && (
              <span className="truncate text-xs font-medium text-red-600">
                {archiveError instanceof ApiError ? archiveError.message : 'Failed to archive.'}
              </span>
            )}
            {restoreError && (
              <span className="truncate text-xs font-medium text-red-600">
                {restoreError instanceof ApiError ? restoreError.message : 'Failed to restore.'}
              </span>
            )}
          </>
        }
      />
      <EventBasicInfoSection event={displayedEvent} mode={mode} onFieldChange={handleFieldChange} />
      <EventTicketingSection event={displayedEvent} mode={mode} onFieldChange={handleFieldChange} />
      <EventCoverSection
        event={displayedEvent}
        mode={mode}
        onUploadCover={handleUploadCover}
        onRemoveCover={handleRemoveCover}
        isUploading={isUploadingCover || isRemovingCover}
        uploadProgress={uploadProgress}
        uploadError={
          uploadCoverError instanceof ApiError
            ? uploadCoverError.message
            : removeCoverError instanceof ApiError
              ? removeCoverError.message
              : uploadCoverError || removeCoverError
                ? 'Failed to update cover image.'
                : null
        }
      />
      <EventPublishingStatusSection event={displayedEvent} />
    </div>
  )
}
