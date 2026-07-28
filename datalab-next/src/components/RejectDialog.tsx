import { useRef, useState } from 'react'
import { ThumbsDown, X } from 'lucide-react'
import { ApiError } from '../lib/apiClient'

type RejectDialogProps = {
  onReject: (reason: string) => Promise<void>
}

/** EP21 — shared by venues and destinations, both of which reject the
 * same way: `review` -> `draft`, requiring a non-blank `reason`
 * (`RejectRequest`, api/app/api/schemas.py). Same native `<dialog>`
 * pattern the create dialogs already established. Owns its own
 * pending/error state (rather than taking it from the caller's mutation
 * hook) so it can close itself the moment `onReject`'s promise resolves.
 */
export function RejectDialog({ onReject }: RejectDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [reason, setReason] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<unknown>(null)
  const [isPending, setIsPending] = useState(false)

  function openDialog() {
    setReason('')
    setFieldError(null)
    setSubmitError(null)
    dialogRef.current?.showModal()
  }

  function closeDialog() {
    dialogRef.current?.close()
  }

  async function handleSubmit() {
    if (reason.trim().length === 0) {
      setFieldError('A reason is required.')
      return
    }
    setFieldError(null)
    setSubmitError(null)
    setIsPending(true)
    try {
      await onReject(reason.trim())
      closeDialog()
    } catch (caught) {
      setSubmitError(caught)
    } finally {
      setIsPending(false)
    }
  }

  const displayedError =
    fieldError ?? (submitError instanceof ApiError ? submitError.message : submitError ? 'Failed to reject.' : null)

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="flex items-center gap-1.5 rounded-lg bg-red-700 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-800"
      >
        <ThumbsDown size={14} />
        Reject
      </button>

      <dialog
        ref={dialogRef}
        className="w-full max-w-sm rounded-xl border border-gray-200 p-0 backdrop:bg-black/40"
      >
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Reject</h2>
            <button type="button" onClick={closeDialog} className="text-gray-400 hover:text-gray-900">
              <X size={16} />
            </button>
          </div>

          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Reason
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              placeholder="Why is this being sent back to draft?"
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
            />
          </label>

          {displayedError && <p className="text-sm text-red-600">{displayedError}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeDialog}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
              className="rounded-lg bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? 'Rejecting…' : 'Reject'}
            </button>
          </div>
        </div>
      </dialog>
    </>
  )
}
