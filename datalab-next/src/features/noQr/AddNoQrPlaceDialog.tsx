import { useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateVenueNoQr } from '../venues/api'
import { NO_QR_TYPES } from '../venues/venueCategories'
import { ApiError } from '../../lib/apiClient'
import type { Venue } from '../../types/venue'

type AddNoQrPlaceDialogProps = {
  venues: readonly Venue[]
}

/** SUPERSEDED — STUDIO — NO QR INDEPENDENT ENTITY (Phase 1) replaced this
 * component's whole premise (marking an existing Venue `is_no_qr`) with
 * `NoQrArea`/`NoQrPlace`, real entities where a Walk/Mall is not a Venue
 * at all (see `api/app/db/models.py`'s docstrings). No longer imported by
 * `pages/NoQr.tsx` or anywhere else. Kept, unused, rather than deleted —
 * the underlying `Venue.is_no_qr`/`parent_venue_id`/`no_qr_type` columns
 * and the Venue editor's own controls for them are still live (Phase 2
 * will remove both once the new model is fully adopted); deleting this
 * file now would be premature per that phase boundary. See
 * `features/noQr/NoQrAreaDetail.tsx`/`AddPlaceDialog.tsx` for the current
 * implementation.
 *
 * Same native `<dialog>` pattern `VenueCreateDialog`/`EventCreateDialog`
 * already establish — no separate modal abstraction exists elsewhere in
 * Studio.
 *
 * Deliberately NOT a "create venue" flow: this designates an EXISTING
 * venue (picked from the already-loaded `venues` list this page already
 * fetches via `useAllVenues`, so no extra request) as a No QR place, via
 * the same `updateVenue`/`is_no_qr`/`no_qr_type` fields the Venue editor's
 * Basic Information section already exposes — same API call, same
 * backend validation (`validate_no_qr_type`), no duplicate logic. Picking
 * a venue that's already `is_no_qr` pre-fills its current state for
 * editing rather than erroring or creating a second designation — there
 * is only ever one `venues` row per place, this only ever updates it. */
export function AddNoQrPlaceDialog({ venues }: AddNoQrPlaceDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Venue | null>(null)
  const [noQrType, setNoQrType] = useState<string>('')
  const [fieldError, setFieldError] = useState<string | null>(null)

  const { mutate: save, isPending, error: submitError, reset: resetSubmitError } = useMutation({
    mutationFn: ({ venue, type }: { venue: Venue; type: Venue['no_qr_type'] }) =>
      updateVenueNoQr(venue.id, venue.version, true, type),
    onSuccess: (updated) => {
      queryClient.setQueryData(['venue', updated.id], updated)
      queryClient.invalidateQueries({ queryKey: ['venues'] })
      closeDialog()
    },
  })

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return venues
      .filter((v) => v.name.toLowerCase().includes(q))
      .slice(0, 20)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [venues, query])

  function openDialog() {
    setQuery('')
    setSelected(null)
    setNoQrType('')
    setFieldError(null)
    resetSubmitError()
    dialogRef.current?.showModal()
  }

  function closeDialog() {
    dialogRef.current?.close()
  }

  function selectVenue(venue: Venue) {
    setSelected(venue)
    setQuery(venue.name)
    // Pre-fill from the venue's current state — editing, not overwriting
    // blind, matches "instead show/edit its existing No QR state."
    setNoQrType(venue.is_no_qr ? (venue.no_qr_type ?? '') : '')
  }

  function handleSave() {
    if (!selected) {
      setFieldError('Select an existing venue first.')
      return
    }
    setFieldError(null)
    save({ venue: selected, type: noQrType === '' ? null : (noQrType as 'Walk' | 'Mall') })
  }

  const displayedError =
    fieldError ?? (submitError instanceof ApiError ? submitError.message : submitError ? 'Failed to save.' : null)

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-700 lg:min-h-0"
      >
        + Add No QR Place
      </button>

      <dialog
        ref={dialogRef}
        className="m-auto max-h-[85vh] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-xl border border-gray-200 p-0 backdrop:bg-black/40"
        onClose={() => resetSubmitError()}
      >
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Add No QR Place</h2>
            <button type="button" onClick={closeDialog} className="text-gray-400 hover:text-gray-900">
              <X size={16} />
            </button>
          </div>

          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Venue
            <input
              type="text"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setSelected(null)
              }}
              placeholder="Search existing venues by name…"
              className="min-h-11 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none lg:min-h-0"
            />
          </label>

          {!selected && matches.length > 0 && (
            <ul className="max-h-48 overflow-y-auto rounded-lg border border-gray-200">
              {matches.map((venue) => (
                <li key={venue.id}>
                  <button
                    type="button"
                    onClick={() => selectVenue(venue)}
                    className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    <span className="font-medium text-gray-900">{venue.name}</span>
                    <span className="text-xs text-gray-400">
                      {venue.category} · {venue.destination.name}
                      {venue.is_no_qr ? ' · already a No QR place' : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {selected && (
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              No QR Type
              <select
                value={noQrType}
                onChange={(event) => setNoQrType(event.target.value)}
                className="min-h-11 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none lg:min-h-0"
              >
                <option value="">Unclassified</option>
                {NO_QR_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          )}

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
              onClick={handleSave}
              disabled={isPending || !selected}
              className="min-h-11 rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50 lg:min-h-0"
            >
              {isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </dialog>
    </>
  )
}
