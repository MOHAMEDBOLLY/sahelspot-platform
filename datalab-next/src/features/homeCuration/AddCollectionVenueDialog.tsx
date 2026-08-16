import { useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { addCollectionVenue } from './api'
import { useAllVenues } from '../stats/useAllVenues'
import { useDestinations } from '../destinations/useDestinations'
import { VENUE_CATEGORIES } from '../venues/venueCategories'
import { ApiError } from '../../lib/apiClient'
import type { Venue } from '../../types/venue'

type AddCollectionVenueDialogProps = {
  collectionId: string
  existingVenueIds: ReadonlySet<string>
}

/** HOME CURATION. Same native `<dialog>` + in-memory venue-search-list
 * pattern as `features/noQr/AddPlaceDialog.tsx` — reused, not
 * reinvented, per the approved plan. Adds destination/category filters
 * on top of name search since the picker already has the full venue
 * list in memory (`useAllVenues`) — no extra request, no new picker
 * architecture. */
export function AddCollectionVenueDialog({ collectionId, existingVenueIds }: AddCollectionVenueDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [destinationId, setDestinationId] = useState('')
  const [category, setCategory] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const { data: venues } = useAllVenues()
  const { data: destinationsData } = useDestinations()
  const destinations = destinationsData?.items

  const { mutate: save, isPending, error: submitError, reset: resetSubmitError } = useMutation({
    mutationFn: (venueId: string) => addCollectionVenue(collectionId, venueId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] })
    },
  })

  const matches = useMemo(() => {
    if (!venues) return []
    const q = query.trim().toLowerCase()
    return venues
      .filter((v) => !q || v.name.toLowerCase().includes(q))
      .filter((v) => !destinationId || v.destination.id === destinationId)
      .filter((v) => !category || v.category === category)
      .slice(0, 20)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [venues, query, destinationId, category])

  function openDialog() {
    setQuery('')
    setDestinationId('')
    setCategory('')
    setFieldError(null)
    resetSubmitError()
    dialogRef.current?.showModal()
  }

  function closeDialog() {
    dialogRef.current?.close()
  }

  function selectVenue(venue: Venue) {
    if (existingVenueIds.has(venue.id)) {
      setFieldError('This venue is already in this section.')
      return
    }
    setFieldError(null)
    save(venue.id)
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
        + Add Venue
      </button>

      <dialog
        ref={dialogRef}
        className="m-auto max-h-[85vh] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-xl border border-gray-200 p-0 backdrop:bg-black/40"
        onClose={() => resetSubmitError()}
      >
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Add Venue</h2>
            <button type="button" onClick={closeDialog} className="text-gray-400 hover:text-gray-900">
              <X size={16} />
            </button>
          </div>

          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Venue
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search venues by name…"
              className="min-h-11 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none lg:min-h-0"
              autoFocus
            />
          </label>

          <div className="flex gap-2">
            <select
              value={destinationId}
              onChange={(event) => setDestinationId(event.target.value)}
              className="min-h-11 flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none lg:min-h-0"
            >
              <option value="">All destinations</option>
              {destinations?.map((destination) => (
                <option key={destination.id} value={destination.id}>
                  {destination.name}
                </option>
              ))}
            </select>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="min-h-11 flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none lg:min-h-0"
            >
              <option value="">All categories</option>
              {VENUE_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          {matches.length > 0 && (
            <ul className="max-h-56 overflow-y-auto rounded-lg border border-gray-200">
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
                      {existingVenueIds.has(venue.id) ? ' · already added' : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {displayedError && <p className="text-sm text-red-600">{displayedError}</p>}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={closeDialog}
              className="min-h-11 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 lg:min-h-0"
            >
              Close
            </button>
          </div>
        </div>
      </dialog>
    </>
  )
}
