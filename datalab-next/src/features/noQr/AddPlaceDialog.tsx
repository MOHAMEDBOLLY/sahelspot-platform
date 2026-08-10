import { useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { addNoQrPlace } from './api'
import { useAllVenues } from '../stats/useAllVenues'
import { ApiError } from '../../lib/apiClient'
import type { Venue } from '../../types/venue'

type AddPlaceDialogProps = {
  areaId: number
  existingVenueIds: ReadonlySet<string>
}

type Mode = 'choose' | 'venue' | 'standalone'

/** STUDIO — NO QR INDEPENDENT ENTITY (Phase 1). Same native `<dialog>`
 * pattern as the rest of Studio's create dialogs. Reuses the venue-
 * search-list approach from the Phase 0 `AddNoQrPlaceDialog` (superseded
 * by this Area-based model, kept temporarily — see that file's own
 * updated docstring) as the "Select Existing Venue" branch here, rather
 * than inventing a second venue picker.
 *
 * Deliberately two branches, not one form: linking an existing Venue
 * sends only `venue_id` (the Venue stays the sole source of truth for
 * its own data — nothing is copied); adding a standalone place sends
 * only `name`, and nothing else is asked for or fabricated (no category,
 * address, coordinates — explicitly out of scope, this isn't a Venue).
 */
export function AddPlaceDialog({ areaId, existingVenueIds }: AddPlaceDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<Mode>('choose')
  const [query, setQuery] = useState('')
  const [placeName, setPlaceName] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const { data: venues } = useAllVenues()

  const { mutate: save, isPending, error: submitError, reset: resetSubmitError } = useMutation({
    mutationFn: (place: { venueId: string; name?: undefined } | { venueId?: undefined; name: string }) =>
      addNoQrPlace(areaId, place),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['no-qr-areas', areaId] })
      queryClient.invalidateQueries({ queryKey: ['no-qr-areas'] })
      closeDialog()
    },
  })

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q || !venues) return []
    return venues
      .filter((v) => v.name.toLowerCase().includes(q))
      .slice(0, 20)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [venues, query])

  function openDialog() {
    setMode('choose')
    setQuery('')
    setPlaceName('')
    setFieldError(null)
    resetSubmitError()
    dialogRef.current?.showModal()
  }

  function closeDialog() {
    dialogRef.current?.close()
  }

  function selectVenue(venue: Venue) {
    if (existingVenueIds.has(venue.id)) {
      setFieldError('This venue is already a place in this Area.')
      return
    }
    setFieldError(null)
    save({ venueId: venue.id })
  }

  function handleAddStandalone() {
    if (!placeName.trim()) {
      setFieldError('Place name is required.')
      return
    }
    setFieldError(null)
    save({ name: placeName.trim() })
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
        + Add Place
      </button>

      <dialog
        ref={dialogRef}
        className="m-auto max-h-[85vh] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-xl border border-gray-200 p-0 backdrop:bg-black/40"
        onClose={() => resetSubmitError()}
      >
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Add Place</h2>
            <button type="button" onClick={closeDialog} className="text-gray-400 hover:text-gray-900">
              <X size={16} />
            </button>
          </div>

          {mode === 'choose' && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setMode('venue')}
                className="rounded-lg border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-900 hover:bg-gray-50"
              >
                Select Existing Venue
              </button>
              <button
                type="button"
                onClick={() => setMode('standalone')}
                className="rounded-lg border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-900 hover:bg-gray-50"
              >
                Add New Place
              </button>
            </div>
          )}

          {mode === 'venue' && (
            <>
              <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                Venue
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search existing venues by name…"
                  className="min-h-11 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none lg:min-h-0"
                  autoFocus
                />
              </label>
              {matches.length > 0 && (
                <ul className="max-h-48 overflow-y-auto rounded-lg border border-gray-200">
                  {matches.map((venue) => (
                    <li key={venue.id}>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => selectVenue(venue)}
                        className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-50"
                      >
                        <span className="font-medium text-gray-900">{venue.name}</span>
                        <span className="text-xs text-gray-400">
                          {venue.category} · {venue.destination.name}
                          {existingVenueIds.has(venue.id) ? ' · already in this Area' : ''}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {mode === 'standalone' && (
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Place Name
              <input
                type="text"
                value={placeName}
                onChange={(event) => setPlaceName(event.target.value)}
                className="min-h-11 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none lg:min-h-0"
                autoFocus
              />
            </label>
          )}

          {displayedError && <p className="text-sm text-red-600">{displayedError}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={mode === 'choose' ? closeDialog : () => setMode('choose')}
              className="min-h-11 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 lg:min-h-0"
            >
              {mode === 'choose' ? 'Cancel' : 'Back'}
            </button>
            {mode === 'standalone' && (
              <button
                type="button"
                onClick={handleAddStandalone}
                disabled={isPending}
                className="min-h-11 rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50 lg:min-h-0"
              >
                {isPending ? 'Adding…' : 'Add Place'}
              </button>
            )}
          </div>
        </div>
      </dialog>
    </>
  )
}
