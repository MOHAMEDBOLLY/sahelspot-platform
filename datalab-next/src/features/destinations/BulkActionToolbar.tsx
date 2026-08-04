import { Archive, ArchiveRestore, Loader2, RotateCcw, Trash2, X } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { hasPermission } from '../auth/permissions'
import { ApiError } from '../../lib/apiClient'
import {
  useBulkArchiveDestinations,
  useBulkDeleteDestinations,
  useBulkMoveDestinationsToDraft,
  useBulkRestoreDestinations,
} from './useBulkDestinationActions'
import type { BulkDestinationOperationResponse, Destination } from '../../types/destination'
import { useState } from 'react'

type BulkActionToolbarProps = {
  checkedDestinations: Destination[]
  onClearSelection: () => void
}

function requestErrorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'The request failed. Please try again.'
}

/** Destination Lifecycle Management — Bulk Operations. Same shape as
 * venues' `BulkActionToolbar` (`features/venues/BulkActionToolbar.tsx`),
 * scoped down to just the four lifecycle actions (Move to Draft, Archive,
 * Restore, Delete) — destinations have no bulk Validate/Submit for
 * Review/Approve/category/destination-reassignment actions in scope here.
 * Same "only send the subset actually eligible for this transition"
 * gating as venues' toolbar, same partial-failure-as-summary reasoning.
 */
export function BulkActionToolbar({ checkedDestinations, onClearSelection }: BulkActionToolbarProps) {
  const { role } = useAuth()
  const [lastResult, setLastResult] = useState<BulkDestinationOperationResponse | null>(null)
  const [requestError, setRequestError] = useState<string | null>(null)

  const { mutate: bulkMoveToDraft, isPending: isMovingToDraft } = useBulkMoveDestinationsToDraft()
  const { mutate: bulkArchive, isPending: isArchiving } = useBulkArchiveDestinations()
  const { mutate: bulkRestore, isPending: isRestoring } = useBulkRestoreDestinations()
  const { mutate: bulkDelete, isPending: isDeleting } = useBulkDeleteDestinations()

  const isProcessing = isMovingToDraft || isArchiving || isRestoring || isDeleting

  const checkedDestinationIds = checkedDestinations.map((d) => d.id)
  const approvedDestinationIds = checkedDestinations.filter((d) => d.status === 'approved').map((d) => d.id)
  const archivedDestinationIds = checkedDestinations.filter((d) => d.status === 'archived').map((d) => d.id)

  const canMoveToDraft = hasPermission(role, 'content_approve') && approvedDestinationIds.length > 0
  const canArchive = hasPermission(role, 'content_approve') && approvedDestinationIds.length > 0
  const canRestore = hasPermission(role, 'content_approve') && archivedDestinationIds.length > 0
  // Delete has no status precondition — same reasoning venues' canDelete
  // gives — every checked destination is eligible, just the permission
  // check; the venue-count/orphaned-event guards run server-side per id.
  const canDelete = hasPermission(role, 'content_edit') && checkedDestinationIds.length > 0

  function beginAction() {
    setLastResult(null)
    setRequestError(null)
  }

  function handleMoveToDraft() {
    const skipped = checkedDestinationIds.length - approvedDestinationIds.length
    const skippedNote =
      skipped > 0 ? ` (${skipped} other selected destination${skipped === 1 ? '' : 's'} not approved — skipped)` : ''
    if (!window.confirm(`Move ${approvedDestinationIds.length} destination(s) back to Draft?${skippedNote}`)) return
    beginAction()
    bulkMoveToDraft(approvedDestinationIds, {
      onSuccess: setLastResult,
      onError: (error) => setRequestError(requestErrorMessage(error)),
    })
  }

  function handleArchive() {
    const skipped = checkedDestinationIds.length - approvedDestinationIds.length
    const skippedNote =
      skipped > 0 ? ` (${skipped} other selected destination${skipped === 1 ? '' : 's'} not approved — skipped)` : ''
    if (!window.confirm(`Archive ${approvedDestinationIds.length} destination(s)?${skippedNote}`)) return
    beginAction()
    bulkArchive(approvedDestinationIds, {
      onSuccess: setLastResult,
      onError: (error) => setRequestError(requestErrorMessage(error)),
    })
  }

  function handleRestore() {
    const skipped = checkedDestinationIds.length - archivedDestinationIds.length
    const skippedNote =
      skipped > 0 ? ` (${skipped} other selected destination${skipped === 1 ? '' : 's'} not archived — skipped)` : ''
    if (!window.confirm(`Restore ${archivedDestinationIds.length} destination(s)?${skippedNote}`)) return
    beginAction()
    bulkRestore(archivedDestinationIds, {
      onSuccess: setLastResult,
      onError: (error) => setRequestError(requestErrorMessage(error)),
    })
  }

  function handleDelete() {
    if (
      !window.confirm(
        `Delete Destination?\n\nThis action cannot be undone. ${checkedDestinationIds.length} destination(s) will be permanently deleted. Destinations that still have venues (or events with no other location) will be skipped.`,
      )
    )
      return
    beginAction()
    bulkDelete(checkedDestinationIds, {
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
        <span className="text-xs font-medium text-gray-700">{checkedDestinationIds.length} selected</span>
        <button
          type="button"
          onClick={onClearSelection}
          className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-900"
        >
          <X size={12} />
          Clear
        </button>
      </div>

      {(canMoveToDraft || canArchive || canRestore || canDelete) && (
        <div className="flex flex-wrap gap-1.5">
          {canMoveToDraft && (
            <button
              type="button"
              onClick={handleMoveToDraft}
              disabled={isProcessing}
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isMovingToDraft ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
              Move to Draft ({approvedDestinationIds.length})
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
              Archive ({approvedDestinationIds.length})
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
              Restore ({archivedDestinationIds.length})
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
              Delete ({checkedDestinationIds.length})
            </button>
          )}
        </div>
      )}

      {isProcessing && <p className="text-xs text-gray-500">Processing {checkedDestinationIds.length} destination(s)…</p>}

      {requestError && <div className="rounded-lg bg-red-50 p-2 text-xs font-medium text-red-700">{requestError}</div>}

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
                  <li key={result.destination_id} className="truncate">
                    {result.destination_id}: {result.error}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
