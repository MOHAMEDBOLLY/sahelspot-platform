import { useRef } from 'react'
import { Rocket } from 'lucide-react'
import { usePublish } from './usePublish'
import { ApiError } from '../../lib/apiClient'
import type { PublishRevisionSummary } from './types'

type PublishButtonProps = {
  onPublished: (revision: PublishRevisionSummary) => void
}

/** Publish (EP17-T01) — confirmation dialog before creating a new
 * revision, same native `<dialog>` pattern `DestinationCreateDialog`
 * already established. Shows `excluded_venue_count` on success rather
 * than treating a successful publish as "everything made it in" — see
 * PLATFORM_SPEC_v1.0_FROZEN.md §1's referential-closure exclusion.
 */
export function PublishButton({ onPublished }: PublishButtonProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const { mutate: publish, isPending, error, reset } = usePublish()

  function openDialog() {
    reset()
    dialogRef.current?.showModal()
  }

  function closeDialog() {
    dialogRef.current?.close()
  }

  function handleConfirm() {
    publish(undefined, {
      onSuccess: (revision) => {
        closeDialog()
        onPublished(revision)
      },
    })
  }

  const displayedError = error instanceof ApiError ? error.message : error ? 'Failed to publish.' : null

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-700 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-800"
      >
        <Rocket size={14} />
        Publish
      </button>

      <dialog
        ref={dialogRef}
        className="w-full max-w-sm rounded-xl border border-gray-200 p-0 backdrop:bg-black/40"
        onClose={() => reset()}
      >
        <div className="flex flex-col gap-4 p-5">
          <h2 className="text-base font-semibold text-gray-900">Publish current content?</h2>
          <p className="text-sm text-gray-600">
            This creates a new revision from every currently approved destination and venue, and
            makes it the live content immediately.
          </p>

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
              onClick={handleConfirm}
              disabled={isPending}
              className="rounded-lg bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? 'Publishing…' : 'Publish'}
            </button>
          </div>
        </div>
      </dialog>
    </>
  )
}
