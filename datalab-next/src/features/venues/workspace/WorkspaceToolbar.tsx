import { Archive, ArchiveRestore, CheckCheck, Loader2, RotateCcw, Send, ThumbsUp } from 'lucide-react'
import { DraftToolbar } from '../../../components/workspace/DraftToolbar'
import { RejectDialog } from '../../../components/RejectDialog'
import { DeleteConfirmDialog } from '../../../components/DeleteConfirmDialog'
import type { WorkspaceMode } from '../../../components/workspace/types'

type WorkspaceToolbarProps = {
  venueName: string
  mode: WorkspaceMode
  isDirty: boolean
  isSaving: boolean
  saveError: string | null
  hasFieldErrors: boolean
  /** Sprint 24 — whether the caller's role grants `content_edit`. Gates
   * the base Edit/Save Draft group (forwarded to `DraftToolbar`) *and*
   * Validate, since the backend requires the same permission for both. */
  canEdit: boolean
  isValidating: boolean
  canSubmitForReview: boolean
  isSubmittingForReview: boolean
  submitForReviewError: string | null
  canApprove: boolean
  isApproving: boolean
  approveError: string | null
  canReject: boolean
  rejectError: string | null
  /** Venue Lifecycle Management — approved -> draft, approved -> archived,
   * archived -> approved (restore). Same "only offer the transition the
   * backend would currently accept" gating as canSubmitForReview/
   * canApprove above, keyed off the venue's persisted status
   * (see VenueWorkspace's canMoveToDraft/canArchive/canRestore). */
  canMoveToDraft: boolean
  isMovingToDraft: boolean
  moveToDraftError: string | null
  canArchive: boolean
  isArchiving: boolean
  archiveError: string | null
  canRestore: boolean
  isRestoring: boolean
  restoreError: string | null
  /** Always available regardless of status (task spec) — no
   * status-eligibility gate like the others above, only permission. */
  canDelete: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: () => void
  onValidate: () => void
  onSubmitForReview: () => void
  onApprove: () => void
  onReject: (reason: string) => Promise<void>
  onMoveToDraft: () => void
  onArchive: () => void
  onRestore: () => void
  onDelete: () => Promise<void>
}

/** The Venue Workspace's toolbar — the generic Edit/Cancel/Save Draft shell
 * (`DraftToolbar`, shared with Destinations and future entities) plus
 * Venue's own Validate/Submit for Review/Approve actions, which don't exist
 * for any other entity yet. */
export function WorkspaceToolbar({
  venueName,
  mode,
  isDirty,
  isSaving,
  saveError,
  hasFieldErrors,
  canEdit,
  isValidating,
  canSubmitForReview,
  isSubmittingForReview,
  submitForReviewError,
  canApprove,
  isApproving,
  approveError,
  canReject,
  rejectError,
  canMoveToDraft,
  isMovingToDraft,
  moveToDraftError,
  canArchive,
  isArchiving,
  archiveError,
  canRestore,
  isRestoring,
  restoreError,
  canDelete,
  onEdit,
  onCancel,
  onSave,
  onValidate,
  onSubmitForReview,
  onApprove,
  onReject,
  onMoveToDraft,
  onArchive,
  onRestore,
  onDelete,
}: WorkspaceToolbarProps) {
  return (
    <DraftToolbar
      title={venueName}
      mode={mode}
      isDirty={isDirty}
      isSaving={isSaving}
      saveError={saveError}
      hasFieldErrors={hasFieldErrors}
      canEdit={canEdit}
      onEdit={onEdit}
      onCancel={onCancel}
      onSave={onSave}
      extraStatus={
        <>
          {submitForReviewError && (
            <span className="truncate text-xs font-medium text-red-600" title={submitForReviewError}>
              {submitForReviewError}
            </span>
          )}
          {approveError && (
            <span className="truncate text-xs font-medium text-red-600" title={approveError}>
              {approveError}
            </span>
          )}
          {rejectError && (
            <span className="truncate text-xs font-medium text-red-600" title={rejectError}>
              {rejectError}
            </span>
          )}
          {moveToDraftError && (
            <span className="truncate text-xs font-medium text-red-600" title={moveToDraftError}>
              {moveToDraftError}
            </span>
          )}
          {archiveError && (
            <span className="truncate text-xs font-medium text-red-600" title={archiveError}>
              {archiveError}
            </span>
          )}
          {restoreError && (
            <span className="truncate text-xs font-medium text-red-600" title={restoreError}>
              {restoreError}
            </span>
          )}
        </>
      }
      extraActions={
        <>
          {canEdit && (
            <button
              type="button"
              onClick={onValidate}
              disabled={isValidating || isDirty}
              title={isDirty ? 'Save Draft first — Validate checks the saved state, not unsaved edits.' : undefined}
              className="flex min-h-11 items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 lg:min-h-0"
            >
              {isValidating ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={14} />}
              {isValidating ? 'Validating…' : 'Validate'}
            </button>
          )}
          {canSubmitForReview && (
            <button
              type="button"
              onClick={onSubmitForReview}
              disabled={isSubmittingForReview}
              className="flex min-h-11 items-center gap-1.5 rounded-lg bg-green-700 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50 lg:min-h-0"
            >
              {isSubmittingForReview ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {isSubmittingForReview ? 'Submitting…' : 'Submit for Review'}
            </button>
          )}
          {canApprove && (
            <button
              type="button"
              onClick={onApprove}
              disabled={isApproving}
              className="flex min-h-11 items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 lg:min-h-0"
            >
              {isApproving ? <Loader2 size={14} className="animate-spin" /> : <ThumbsUp size={14} />}
              {isApproving ? 'Approving…' : 'Approve'}
            </button>
          )}
          {canReject && <RejectDialog onReject={onReject} />}
          {canMoveToDraft && (
            <button
              type="button"
              onClick={onMoveToDraft}
              disabled={isMovingToDraft}
              className="flex min-h-11 items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 lg:min-h-0"
            >
              {isMovingToDraft ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
              {isMovingToDraft ? 'Moving to Draft…' : 'Move to Draft'}
            </button>
          )}
          {canArchive && (
            <button
              type="button"
              onClick={onArchive}
              disabled={isArchiving}
              className="flex min-h-11 items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 lg:min-h-0"
            >
              {isArchiving ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
              {isArchiving ? 'Archiving…' : 'Archive'}
            </button>
          )}
          {canRestore && (
            <button
              type="button"
              onClick={onRestore}
              disabled={isRestoring}
              className="flex min-h-11 items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 lg:min-h-0"
            >
              {isRestoring ? <Loader2 size={14} className="animate-spin" /> : <ArchiveRestore size={14} />}
              {isRestoring ? 'Restoring…' : 'Restore'}
            </button>
          )}
          {canDelete && <DeleteConfirmDialog onConfirm={onDelete} />}
        </>
      }
    />
  )
}
