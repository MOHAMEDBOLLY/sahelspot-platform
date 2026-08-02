import { useState } from 'react'
import { CheckCheck, Loader2, Send, ThumbsUp, X } from 'lucide-react'
import { useDestinations } from '../destinations/useDestinations'
import { useAuth } from '../auth/useAuth'
import { hasPermission } from '../auth/permissions'
import { ApiError } from '../../lib/apiClient'
import { VENUE_CATEGORIES } from './venueCategories'
import {
  useBulkApproveVenues,
  useBulkSubmitVenuesForReview,
  useBulkUpdateVenueCategory,
  useBulkUpdateVenueDestination,
  useBulkValidateVenues,
} from './useBulkVenueActions'
import type { BulkOperationResponse, Venue } from '../../types/venue'

type BulkActionToolbarProps = {
  checkedVenues: Venue[]
  onClearSelection: () => void
}

function requestErrorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'The request failed. Please try again.'
}

/** Sprint 28 — Bulk Operations. Every action here calls the same bulk
 * endpoint the backend exposes and reports whatever mix of success/failure
 * comes back — partial failure is the normal case for a bulk action, not
 * an error state, so results render as a summary rather than a thrown
 * error. Submit for Review, Approve, and both bulk updates ask for
 * confirmation first (`window.confirm`, the same mechanism
 * `VenueWorkspace` already uses for the dirty-switch warning — no new
 * dialog component); Validate doesn't, since it never mutates anything.
 *
 * Two gate-review fixes: (1) a whole-request failure (403/404/422/500/
 * network error — as opposed to a per-item failure inside a successful
 * response) is caught via each mutation's `onError` and shown as its own
 * banner, separate from the existing success/partial-failure summary.
 * (2) each action is hidden when the caller's role doesn't grant the
 * permission the backend already requires for it — same
 * `hasPermission(role, permission)` helper `VenueWorkspace` uses, not a
 * second permission check reimplemented here.
 *
 * Status-eligibility fix — Submit for Review and Approve are workflow
 * transitions with a real precondition (`draft -> review`,
 * `review -> approved`), the same one `require_status()` enforces on the
 * backend and the single-venue `VenueWorkspace` already gates its own
 * buttons on (`canSubmitForReview`/`canApprove`). This toolbar used to
 * send *every* checked id regardless of its actual status, so selecting
 * a mix (or an already-submitted batch) produced confusing per-item 409s
 * ("Resource is in 'review' status; only a 'draft' resource can move to
 * 'review'.") that read like the workflow itself was broken. Both
 * buttons now only ever send the subset of checked venues actually
 * eligible for that transition, and are disabled entirely (not just
 * silently no-op) when none of the selection qualifies — mirroring the
 * backend's own state machine instead of relying on it to reject a
 * request the UI could have avoided sending.
 */
export function BulkActionToolbar({ checkedVenues, onClearSelection }: BulkActionToolbarProps) {
  // Sprint 29: useDestinations() now returns a paginated envelope
  // ({items, total, ...}), not a bare array — .items is the list itself.
  const { data: destinationsData } = useDestinations()
  const destinations = destinationsData?.items
  const { role } = useAuth()
  const [categoryChoice, setCategoryChoice] = useState('')
  const [destinationChoice, setDestinationChoice] = useState('')
  const [lastResult, setLastResult] = useState<BulkOperationResponse | null>(null)
  const [requestError, setRequestError] = useState<string | null>(null)

  const { mutate: bulkValidate, isPending: isValidating } = useBulkValidateVenues()
  const { mutate: bulkSubmitForReview, isPending: isSubmitting } = useBulkSubmitVenuesForReview()
  const { mutate: bulkApprove, isPending: isApproving } = useBulkApproveVenues()
  const { mutate: bulkUpdateCategory, isPending: isUpdatingCategory } = useBulkUpdateVenueCategory()
  const { mutate: bulkUpdateDestination, isPending: isUpdatingDestination } =
    useBulkUpdateVenueDestination()

  const isProcessing = isValidating || isSubmitting || isApproving || isUpdatingCategory || isUpdatingDestination

  const checkedVenueIds = checkedVenues.map((v) => v.id)
  const draftVenueIds = checkedVenues.filter((v) => v.status === 'draft').map((v) => v.id)
  const reviewVenueIds = checkedVenues.filter((v) => v.status === 'review').map((v) => v.id)

  const canValidate = hasPermission(role, 'content_edit')
  const canSubmitForReview = hasPermission(role, 'content_submit_review') && draftVenueIds.length > 0
  const canApprove = hasPermission(role, 'content_approve') && reviewVenueIds.length > 0
  const canEdit = hasPermission(role, 'content_edit')

  function beginAction() {
    setLastResult(null)
    setRequestError(null)
  }

  function handleValidate() {
    beginAction()
    bulkValidate(checkedVenueIds, { onSuccess: setLastResult, onError: (error) => setRequestError(requestErrorMessage(error)) })
  }

  function handleSubmitForReview() {
    const skipped = checkedVenueIds.length - draftVenueIds.length
    const skippedNote = skipped > 0 ? ` (${skipped} other selected venue${skipped === 1 ? '' : 's'} already past draft — skipped)` : ''
    if (!window.confirm(`Submit ${draftVenueIds.length} venue(s) for review?${skippedNote}`)) return
    beginAction()
    bulkSubmitForReview(draftVenueIds, {
      onSuccess: setLastResult,
      onError: (error) => setRequestError(requestErrorMessage(error)),
    })
  }

  function handleApprove() {
    const skipped = checkedVenueIds.length - reviewVenueIds.length
    const skippedNote = skipped > 0 ? ` (${skipped} other selected venue${skipped === 1 ? '' : 's'} not in review — skipped)` : ''
    if (!window.confirm(`Approve ${reviewVenueIds.length} venue(s)?${skippedNote}`)) return
    beginAction()
    bulkApprove(reviewVenueIds, {
      onSuccess: setLastResult,
      onError: (error) => setRequestError(requestErrorMessage(error)),
    })
  }

  function handleApplyCategory() {
    if (!categoryChoice) return
    if (!window.confirm(`Set category to "${categoryChoice}" for ${checkedVenueIds.length} venue(s)?`)) return
    beginAction()
    bulkUpdateCategory(
      { venueIds: checkedVenueIds, category: categoryChoice },
      { onSuccess: setLastResult, onError: (error) => setRequestError(requestErrorMessage(error)) },
    )
  }

  function handleApplyDestination() {
    if (!destinationChoice) return
    const destinationName = destinations?.find((d) => d.id === destinationChoice)?.name ?? destinationChoice
    if (
      !window.confirm(`Move ${checkedVenueIds.length} venue(s) to "${destinationName}"?`)
    ) {
      return
    }
    beginAction()
    bulkUpdateDestination(
      { venueIds: checkedVenueIds, destinationId: destinationChoice },
      { onSuccess: setLastResult, onError: (error) => setRequestError(requestErrorMessage(error)) },
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-700">
          {checkedVenueIds.length} selected
        </span>
        <button
          type="button"
          onClick={onClearSelection}
          className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-900"
        >
          <X size={12} />
          Clear
        </button>
      </div>

      {(canValidate || canSubmitForReview || canApprove) && (
        <div className="flex flex-wrap gap-1.5">
          {canValidate && (
            <button
              type="button"
              onClick={handleValidate}
              disabled={isProcessing}
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isValidating ? <Loader2 size={12} className="animate-spin" /> : <CheckCheck size={12} />}
              Validate
            </button>
          )}
          {canSubmitForReview && (
            <button
              type="button"
              onClick={handleSubmitForReview}
              disabled={isProcessing}
              className="flex items-center gap-1 rounded-lg bg-green-700 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              Submit for Review ({draftVenueIds.length})
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
              Approve ({reviewVenueIds.length})
            </button>
          )}
        </div>
      )}

      {canEdit && (
        <div className="flex gap-1.5">
          <select
            value={categoryChoice}
            onChange={(event) => setCategoryChoice(event.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-900"
          >
            <option value="">Set category…</option>
            {VENUE_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleApplyCategory}
            disabled={isProcessing || !categoryChoice}
            className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      )}

      {canEdit && (
        <div className="flex gap-1.5">
          <select
            value={destinationChoice}
            onChange={(event) => setDestinationChoice(event.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-900"
          >
            <option value="">Move to destination…</option>
            {destinations?.map((destination) => (
              <option key={destination.id} value={destination.id}>
                {destination.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleApplyDestination}
            disabled={isProcessing || !destinationChoice}
            className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      )}

      {isProcessing && <p className="text-xs text-gray-500">Processing {checkedVenueIds.length} venue(s)…</p>}

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
                  <li key={result.venue_id} className="truncate">
                    {result.venue_id}: {result.error}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
