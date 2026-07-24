import { CheckCheck, Loader2, Send, ThumbsUp } from 'lucide-react'
import { DraftToolbar } from '../../../components/workspace/DraftToolbar'
import type { WorkspaceMode } from '../../../components/workspace/types'

type WorkspaceToolbarProps = {
  venueName: string
  mode: WorkspaceMode
  isDirty: boolean
  isSaving: boolean
  saveError: string | null
  hasFieldErrors: boolean
  isValidating: boolean
  canSubmitForReview: boolean
  isSubmittingForReview: boolean
  submitForReviewError: string | null
  canApprove: boolean
  isApproving: boolean
  approveError: string | null
  onEdit: () => void
  onCancel: () => void
  onSave: () => void
  onValidate: () => void
  onSubmitForReview: () => void
  onApprove: () => void
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
  isValidating,
  canSubmitForReview,
  isSubmittingForReview,
  submitForReviewError,
  canApprove,
  isApproving,
  approveError,
  onEdit,
  onCancel,
  onSave,
  onValidate,
  onSubmitForReview,
  onApprove,
}: WorkspaceToolbarProps) {
  return (
    <DraftToolbar
      title={venueName}
      mode={mode}
      isDirty={isDirty}
      isSaving={isSaving}
      saveError={saveError}
      hasFieldErrors={hasFieldErrors}
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
        </>
      }
      extraActions={
        <>
          <button
            type="button"
            onClick={onValidate}
            disabled={isValidating || isDirty}
            title={isDirty ? 'Save Draft first — Validate checks the saved state, not unsaved edits.' : undefined}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isValidating ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={14} />}
            {isValidating ? 'Validating…' : 'Validate'}
          </button>
          {canSubmitForReview && (
            <button
              type="button"
              onClick={onSubmitForReview}
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
              onClick={onApprove}
              disabled={isApproving}
              className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isApproving ? <Loader2 size={14} className="animate-spin" /> : <ThumbsUp size={14} />}
              {isApproving ? 'Approving…' : 'Approve'}
            </button>
          )}
        </>
      }
    />
  )
}
