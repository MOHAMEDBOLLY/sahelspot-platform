import { useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useCreateVenue } from './useCreateVenue'
import { useDestinations } from '../destinations/useDestinations'
import { VENUE_CATEGORIES } from './venueCategories'
import { isRequired } from '../../lib/validation'
import { ApiError } from '../../lib/apiClient'
import type { Venue } from '../../types/venue'

const BEACH_PUBLIC_ACCESS_VALUES = ['yes', 'no', 'unknown'] as const

type VenueCreateDialogProps = {
  onCreated: (venue: Venue) => void
}

/** EP19-T01 — "New Venue" form. Same native `<dialog>` pattern
 * `DestinationCreateDialog` already established: no separate modal
 * abstraction exists elsewhere in Studio, and `showModal()` gives
 * focus-trapping, an implicit backdrop, and Escape-to-close for free.
 *
 * EP19-T02 — conditional beach fields: `beachType`/`publicAccess` are
 * only sent as `beach_details` when `category === 'Beach'`, matching the
 * backend's own gate (`validate_beach_details_shape`,
 * api/app/validation/venues.py) rather than duplicating its rules — the
 * backend still rejects any shape it doesn't like; these fields just
 * avoid the round trip for the always-invalid case.
 */
export function VenueCreateDialog({ onCreated }: VenueCreateDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [destinationId, setDestinationId] = useState('')
  const [category, setCategory] = useState<string>(VENUE_CATEGORIES[0])
  const [beachType, setBeachType] = useState('')
  const [publicAccess, setPublicAccess] = useState<string>(BEACH_PUBLIC_ACCESS_VALUES[0])
  const [fieldError, setFieldError] = useState<string | null>(null)
  const { mutate: create, isPending, error: submitError, reset: resetSubmitError } = useCreateVenue()
  const { data: destinationsData } = useDestinations()
  const destinations = destinationsData?.items

  const isBeach = category === 'Beach'

  function openDialog() {
    setId('')
    setName('')
    setSlug('')
    setDestinationId('')
    setCategory(VENUE_CATEGORIES[0])
    setBeachType('')
    setPublicAccess(BEACH_PUBLIC_ACCESS_VALUES[0])
    setFieldError(null)
    resetSubmitError()
    dialogRef.current?.showModal()
  }

  function closeDialog() {
    dialogRef.current?.close()
  }

  function handleSubmit() {
    if (!isRequired(id) || !isRequired(name) || !isRequired(slug) || !isRequired(destinationId)) {
      setFieldError('Id, name, slug, and destination are all required.')
      return
    }
    if (isBeach && !isRequired(beachType)) {
      setFieldError('Beach type is required for a Beach venue.')
      return
    }
    setFieldError(null)
    create(
      {
        id: id.trim(),
        name: name.trim(),
        slug: slug.trim(),
        destination_id: destinationId,
        category,
        beach_details: isBeach ? { type: beachType.trim(), publicAccess } : null,
      },
      {
        onSuccess: (venue) => {
          closeDialog()
          onCreated(venue)
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
        + New Venue
      </button>

      <dialog
        ref={dialogRef}
        className="w-full max-w-sm rounded-xl border border-gray-200 p-0 backdrop:bg-black/40"
        onClose={() => resetSubmitError()}
      >
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">New Venue</h2>
            <button type="button" onClick={closeDialog} className="text-gray-400 hover:text-gray-900">
              <X size={16} />
            </button>
          </div>

          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Id
            <input
              type="text"
              value={id}
              onChange={(event) => setId(event.target.value)}
              placeholder="e.g. beach-bar-marassi"
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
            Slug
            <input
              type="text"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Destination
            <select
              value={destinationId}
              onChange={(event) => setDestinationId(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
            >
              <option value="">Select a destination…</option>
              {destinations?.map((destination) => (
                <option key={destination.id} value={destination.id}>
                  {destination.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Category
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
            >
              {VENUE_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          {isBeach && (
            <>
              <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                Beach Type
                <input
                  type="text"
                  value={beachType}
                  onChange={(event) => setBeachType(event.target.value)}
                  placeholder="e.g. sandy"
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                Public Access
                <select
                  value={publicAccess}
                  onChange={(event) => setPublicAccess(event.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
                >
                  {BEACH_PUBLIC_ACCESS_VALUES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

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
