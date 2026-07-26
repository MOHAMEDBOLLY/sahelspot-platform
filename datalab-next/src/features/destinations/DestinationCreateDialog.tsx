import { useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useCreateDestination } from './useCreateDestination'
import { isRequired } from '../../lib/validation'
import { ApiError } from '../../lib/apiClient'
import type { Destination } from '../../types/destination'

type DestinationCreateDialogProps = {
  onCreated: (destination: Destination) => void
}

/** Sprint 29 — the native `<dialog>` element, not a custom modal
 * component: no dialog/modal abstraction exists anywhere else in Studio
 * yet, and `showModal()` already gives focus-trapping, an implicit
 * backdrop, and Escape-to-close for free — building a bespoke overlay
 * component would be exactly the kind of new abstraction this sprint's
 * constraints ask to avoid. Field-level checks reuse `lib/validation.ts`'s
 * generic `isRequired`, the same UX-only rule `destinationValidation.ts`
 * already uses — the backend's `409`-on-duplicate-id is still the
 * canonical check; this only catches empty fields before a request is
 * even sent.
 */
export function DestinationCreateDialog({ onCreated }: DestinationCreateDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [region, setRegion] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const { mutate: create, isPending, error: submitError, reset: resetSubmitError } = useCreateDestination()

  function openDialog() {
    setId('')
    setName('')
    setRegion('')
    setFieldError(null)
    resetSubmitError()
    dialogRef.current?.showModal()
  }

  function closeDialog() {
    dialogRef.current?.close()
  }

  function handleSubmit() {
    if (!isRequired(id) || !isRequired(name) || !isRequired(region)) {
      setFieldError('Id, name, and region are all required.')
      return
    }
    setFieldError(null)
    create(
      { id: id.trim(), name: name.trim(), region: region.trim() },
      {
        onSuccess: (destination) => {
          closeDialog()
          onCreated(destination)
        },
      },
    )
  }

  const displayedError =
    fieldError ?? (submitError instanceof ApiError ? submitError.message : submitError ? 'Failed to create.' : null)

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="flex items-center justify-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-700"
      >
        + New Destination
      </button>

      <dialog
        ref={dialogRef}
        className="w-full max-w-sm rounded-xl border border-gray-200 p-0 backdrop:bg-black/40"
        onClose={() => resetSubmitError()}
      >
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">New Destination</h2>
            <button type="button" onClick={closeDialog} className="text-gray-400 hover:text-gray-900">
              <X size={16} />
            </button>
          </div>

          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Id (slug)
            <input
              type="text"
              value={id}
              onChange={(event) => setId(event.target.value)}
              placeholder="e.g. marassi"
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Name
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Region
            <input
              type="text"
              value={region}
              onChange={(event) => setRegion(event.target.value)}
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
              className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
      </dialog>
    </>
  )
}
