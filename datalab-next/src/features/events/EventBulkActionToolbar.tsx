import { useState } from 'react'
import { Archive, ArchiveRestore, Loader2, RotateCcw, Send, ThumbsUp, Trash2, X } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { hasPermission } from '../auth/permissions'
import { ApiError } from '../../lib/apiClient'
import {
  useBulkApproveEvents,
  useBulkArchiveEvents,
  useBulkDeleteEvents,
  useBulkMoveEventsToDraft,
  useBulkRestoreEvents,
  useBulkSubmitEventsForReview,
} from './useBulkEventActions'
import type { Event, EventBulkOperationResponse } from '../../types/event'

type EventBulkActionToolbarProps = {
  checkedEvents: Event[]
  onClearSelection: () => void
}

function requestErrorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'The request failed. Please try again.'
}

/** Events Module v1 — same shape as venues' `BulkActionToolbar`, trimmed
 * to the actions this entity actually has (no category/destination bulk
 * update — events don't have a bulk-editable field equivalent). Every
 * action only ever sends the subset of checked events actually eligible
 * for that transition, same "mirror the backend's own state machine"
 * reasoning venues' toolbar already established.
 */
export function EventBulkActionToolbar({ checkedEvents, onClearSelection }: EventBulkActionToolbarProps) {
  const { role } = useAuth()
  const [lastResult, setLastResult] = useState<EventBulkOperationResponse | null>(null)
  const [requestError, setRequestError] = useState<string | null>(null)

  const { mutate: bulkSubmitForReview, isPending: isSubmitting } = useBulkSubmitEventsForReview()
  const { mutate: bulkApprove, isPending: isApproving } = useBulkApproveEvents()
  const { mutate: bulkMoveToDraft, isPending: isMovingToDraft } = useBulkMoveEventsToDraft()
  const { mutate: bulkArchive, isPending: isArchiving } = useBulkArchiveEvents()
  const { mutate: bulkRestore, isPending: isRestoring } = useBulkRestoreEvents()
  const { mutate: bulkDelete, isPending: isDeleting } = useBulkDeleteEvents()

  const isProcessing = isSubmitting || isApproving || isMovingToDraft || isArchiving || isRestoring || isDeleting

  const checkedEventIds = checkedEvents.map((e) => e.id)
  const draftEventIds = checkedEvents.filter((e) => e.status === 'draft').map((e) => e.id)
  const reviewEventIds = checkedEvents.filter((e) => e.status === 'review').map((e) => e.id)
  const approvedEventIds = checkedEvents.filter((e) => e.status === 'approved').map((e) => e.id)
  const archivedEventIds = checkedEvents.filter((e) => e.status === 'archived').map((e) => e.id)

  const canSubmitForReview = hasPermission(role, 'content_submit_review') && draftEventIds.length > 0
  const canApprove = hasPermission(role, 'content_approve') && reviewEventIds.length > 0
  const canMoveToDraft = hasPermission(role, 'content_approve') && approvedEventIds.length > 0
  const canArchive = hasPermission(role, 'content_approve') && approvedEventIds.length > 0
  const canRestore = hasPermission(role, 'content_approve') && archivedEventIds.length > 0
  const canDelete = hasPermission(role, 'content_edit') && checkedEventIds.length > 0

  function beginAction() {
    setLastResult(null)
    setRequestError(null)
  }

  function handleSubmitForReview() {
    const skipped = checkedEventIds.length - draftEventIds.length
    const skippedNote = skipped > 0 ? ` (${skipped} other selected event${skipped === 1 ? '' : 's'} already past draft — skipped)` : ''
    if (!window.confirm(`Submit ${draftEventIds.length} event(s) for review?${skippedNote}`)) return
    beginAction()
    bulkSubmitForReview(draftEventIds, {
      onSuccess: setLastResult,
      onError: (error) => setRequestError(requestErrorMessage(error)),
    })
  }

  function handleApprove() {
    const skipped = checkedEventIds.length - reviewEventIds.length
    const skippedNote = skipped > 0 ? ` (${skipped} other selected event${skipped === 1 ? '' : 's'} not in review — skipped)` : ''
    if (!window.confirm(`Approve ${reviewEventIds.length} event(s)?${skippedNote}`)) return
    beginAction()
    bulkApprove(reviewEventIds, {
      onSuccess: setLastResult,
      onError: (error) => setRequestError(requestErrorMessage(error)),
    })
  }

  function handleMoveToDraft() {
    if (!window.confirm(`Move ${approvedEventIds.length} event(s) back to Draft?`)) return
    beginAction()
    bulkMoveToDraft(approvedEventIds, {
      onSuccess: setLastResult,
      onError: (error) => setRequestError(requestErrorMessage(error)),
    })
  }

  function handleArchive() {
    if (!window.confirm(`Archive ${approvedEventIds.length} event(s)?`)) return
    beginAction()
    bulkArchive(approvedEventIds, {
      onSuccess: setLastResult,
      onError: (error) => setRequestError(requestErrorMessage(error)),
    })
  }

  function handleRestore() {
    if (!window.confirm(`Restore ${archivedEventIds.length} event(s)?`)) return
    beginAction()
    bulkRestore(archivedEventIds, {
      onSuccess: setLastResult,
      onError: (error) => setRequestError(requestErrorMessage(error)),
    })
  }

  function handleDelete() {
    if (!window.confirm(`Delete Event?\n\nThis action cannot be undone. ${checkedEventIds.length} event(s) will be permanently deleted.`)) return
    beginAction()
    bulkDelete(checkedEventIds, {
      onSuccess: (result) => {
        setLastResult(result)
        onClearSelection()
      },
      onError: (error) => setRequestError(requestErrorMessage(error)),
    })
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-700">{checkedEventIds.length} selected</span>
        <button
          type="button"
          onClick={onClearSelection}
          className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-900"
        >
          <X size={12} />
          Clear
        </button>
      </div>

      {(canSubmitForReview || canApprove || canMoveToDraft || canArchive || canRestore || canDelete) && (
        <div className="flex flex-wrap gap-1.5">
          {canSubmitForReview && (
            <button
              type="button"
              onClick={handleSubmitForReview}
              disabled={isProcessing}
              className="flex items-center gap-1 rounded-lg bg-green-700 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              Submit for Review ({draftEventIds.length})
            </button>
          )}
          {canApprove && (
            <button
              type="button"
              onClick={handleApprove}
              disabled={isProcessing}
              className="flex items-center gap-1 rounded-lg bg-blue-700 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isApproving ? <Loader2 size={12} className="animate-spin" /> : <ThumbsUp size={12} />}
              Approve ({reviewEventIds.length})
            </button>
          )}
          {canMoveToDraft && (
            <button
              type="button"
              onClick={handleMoveToDraft}
              disabled={isProcessing}
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isMovingToDraft ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
              Move to Draft ({approvedEventIds.length})
            </button>
          )}
          {canArchive && (
            <button
              type="button"
              onClick={handleArchive}
              disabled={isProcessing}
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isArchiving ? <Loader2 size={12} className="animate-spin" /> : <Archive size={12} />}
              Archive ({approvedEventIds.length})
            </button>
          )}
          {canRestore && (
            <button
              type="button"
              onClick={handleRestore}
              disabled={isProcessing}
              className="flex items-center gap-1 rounded-lg bg-blue-700 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRestoring ? <Loader2 size={12} className="animate-spin" /> : <ArchiveRestore size={12} />}
              Restore ({archivedEventIds.length})
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isProcessing}
              className="flex items-center gap-1 rounded-lg border border-red-300 px-2 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              Delete ({checkedEventIds.length})
            </button>
          )}
        </div>
      )}

      {isProcessing && <p className="text-xs text-gray-500">Processing {checkedEventIds.length} event(s)…</p>}

      {requestError && (
        <div className="rounded-lg bg-red-50 p-2 text-xs font-medium text-red-700">{requestError}</div>
      )}

      {lastResult && (
        <div className="rounded-lg bg-gray-50 p-2 text-xs">
          <p className="font-medium text-gray-700">
            {lastResult.succeeded} succeeded, {lastResult.failed} failed
          </p>
          {lastResult.failed > 0 && (
            <ul className="mt-1 flex flex-col gap-0.5 text-red-600">
              {lastResult.results
                .filter((result) => !result.success)
                .map((result) => (
                  <li key={result.event_id} className="truncate">
                    {result.event_id}: {result.error}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
