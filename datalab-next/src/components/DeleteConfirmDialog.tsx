import { useRef, useState } from 'react'
import { Trash2, X } from 'lucide-react'
import { ApiError } from '../lib/apiClient'

type DeleteConfirmDialogProps = {
  onConfirm: () => Promise<void>
  /** Events Module v1 — this dialog was venue-only until Events reused
   * it, hardcoding "Delete Venue?" as the title regardless of caller.
   * Defaults to "Venue" so the original caller is unaffected either way. */
  entityLabel?: string
}

/** Venue Lifecycle Management — Delete requires confirmation, exact copy
 * per spec ("Delete Venue?" / "This action cannot be undone." /
 * Cancel+Delete). Same native `<dialog>` shape `RejectDialog` already
 * established (owns its own pending/error state, closes itself once
 * `onConfirm` resolves) — no new dialog pattern introduced, just reused.
 */
export function DeleteConfirmDialog({ onConfirm, entityLabel = 'Venue' }: DeleteConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [submitError, setSubmitError] = useState<unknown>(null)
  const [isPending, setIsPending] = useState(false)

  function openDialog() {
    setSubmitError(null)
    dialogRef.current?.showModal()
  }

  function closeDialog() {
    dialogRef.current?.close()
  }

  async function handleConfirm() {
    setSubmitError(null)
    setIsPending(true)
    try {
      await onConfirm()
      closeDialog()
    } catch (caught) {
      setSubmitError(caught)
    } finally {
      setIsPending(false)
    }
  }

  const displayedError =
    submitError instanceof ApiError ? submitError.message : submitError ? 'Failed to delete.' : null

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="flex min-h-11 items-center gap-1.5 rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 lg:min-h-0"
      >
        <Trash2 size={14} />
        Delete
      </button>

      <dialog
        ref={dialogRef}
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-xl border border-gray-200 p-0 backdrop:bg-black/40"
      >
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Delete {entityLabel}?</h2>
            <button type="button" onClick={closeDialog} className="text-gray-400 hover:text-gray-900">
              <X size={16} />
            </button>
          </div>

          <p className="text-sm text-gray-600">This action cannot be undone.</p>

          {displayedError && <p className="text-sm text-red-600">{displayedError}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeDialog}
              className="min-h-11 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 lg:min-h-0"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isPending}
              className="min-h-11 rounded-lg bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50 lg:min-h-0"
            >
              {isPending ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </dialog>
    </>
  )
}
