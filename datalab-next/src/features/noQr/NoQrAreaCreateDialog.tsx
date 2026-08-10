import { useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createNoQrArea } from './api'
import { ApiError } from '../../lib/apiClient'
import type { NoQrArea, NoQrAreaType } from '../../types/noQrArea'

type NoQrAreaCreateDialogProps = {
  type: NoQrAreaType
  onCreated: (area: NoQrArea) => void
}

/** STUDIO — NO QR INDEPENDENT ENTITY (Phase 1). Same native `<dialog>`
 * pattern `VenueCreateDialog`/`EventCreateDialog` establish. Deliberately
 * the smallest possible form — a Walk/Mall is not a Venue, so unlike
 * those two dialogs there is no category/destination/address to ask for,
 * per the approved Phase 1 UX (name only). One component handles both
 * "Add Walk" and "Add Mall" — same shape, different `type`. */
export function NoQrAreaCreateDialog({ type, onCreated }: NoQrAreaCreateDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)

  const { mutate: create, isPending, error: submitError, reset: resetSubmitError } = useMutation({
    mutationFn: () => createNoQrArea(name.trim(), type),
    onSuccess: (area) => {
      queryClient.invalidateQueries({ queryKey: ['no-qr-areas'] })
      closeDialog()
      onCreated(area)
    },
  })

  function openDialog() {
    setName('')
    setFieldError(null)
    resetSubmitError()
    dialogRef.current?.showModal()
  }

  function closeDialog() {
    dialogRef.current?.close()
  }

  function handleSubmit() {
    if (!name.trim()) {
      setFieldError(`${type} name is required.`)
      return
    }
    setFieldError(null)
    create()
  }

  const displayedError =
    fieldError ?? (submitError instanceof ApiError ? submitError.message : submitError ? 'Failed to create.' : null)

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-700 lg:min-h-0"
      >
        + Add {type}
      </button>

      <dialog
        ref={dialogRef}
        className="m-auto max-h-[85vh] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-xl border border-gray-200 p-0 backdrop:bg-black/40"
        onClose={() => resetSubmitError()}
      >
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Add {type}</h2>
            <button type="button" onClick={closeDialog} className="text-gray-400 hover:text-gray-900">
              <X size={16} />
            </button>
          </div>

          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            {type} Name
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="min-h-11 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none lg:min-h-0"
            />
          </label>

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
              onClick={handleSubmit}
              disabled={isPending}
              className="min-h-11 rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50 lg:min-h-0"
            >
              {isPending ? 'Creating…' : `Create ${type}`}
            </button>
          </div>
        </div>
      </dialog>
    </>
  )
}
