import { useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useCreateEvent } from './useCreateEvent'
import { useVenues } from '../venues/useVenues'
import { useDestinations } from '../destinations/useDestinations'
import { isRequired } from '../../lib/validation'
import { ApiError } from '../../lib/apiClient'
import type { Event } from '../../types/event'

type EventCreateDialogProps = {
  onCreated: (event: Event) => void
}

/** Events Module v1 — same native `<dialog>` pattern
 * `DestinationCreateDialog` already established. `id`/`slug`/`title`/
 * `start_date` are the minimal create fields, same "everything else in
 * Edit Mode" shape venues/destinations already use — except location:
 * the backend requires at least one of venue/destination on every event
 * (`ck_events_has_location`), so unlike ticketing/cover/description this
 * one has to be collected here, not deferred to the workspace.
 */
export function EventCreateDialog({ onCreated }: EventCreateDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [id, setId] = useState('')
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [startDate, setStartDate] = useState('')
  const [venueId, setVenueId] = useState('')
  const [destinationId, setDestinationId] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const { mutate: create, isPending, error: submitError, reset: resetSubmitError } = useCreateEvent()
  const { data: venuesData } = useVenues({ pageSize: 100 })
  const { data: destinationsData } = useDestinations({ pageSize: 100 })
  const venues = venuesData?.items ?? []
  const destinations = destinationsData?.items ?? []

  function openDialog() {
    setId('')
    setTitle('')
    setSlug('')
    setStartDate('')
    setVenueId('')
    setDestinationId('')
    setFieldError(null)
    resetSubmitError()
    dialogRef.current?.showModal()
  }

  function closeDialog() {
    dialogRef.current?.close()
  }

  function handleSubmit() {
    if (!isRequired(id) || !isRequired(title) || !isRequired(slug) || !isRequired(startDate)) {
      setFieldError('Id, title, slug, and start date are all required.')
      return
    }
    if (!venueId && !destinationId) {
      setFieldError('Choose a venue, a destination, or both.')
      return
    }
    setFieldError(null)
    create(
      {
        id: id.trim(),
        title: title.trim(),
        slug: slug.trim(),
        start_date: startDate,
        venue_id: venueId || null,
        destination_id: destinationId || null,
      },
      {
        onSuccess: (event) => {
          closeDialog()
          onCreated(event)
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
        + New Event
      </button>

      <dialog
        ref={dialogRef}
        className="w-full max-w-sm rounded-xl border border-gray-200 p-0 backdrop:bg-black/40"
        onClose={() => resetSubmitError()}
      >
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">New Event</h2>
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
              placeholder="e.g. kite-festival-2026"
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Title
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
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
            Start date
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Venue
            <select
              value={venueId}
              onChange={(event) => setVenueId(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
            >
              <option value="">No venue</option>
              {venues.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Destination
            <select
              value={destinationId}
              onChange={(event) => setDestinationId(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
            >
              <option value="">No destination</option>
              {destinations.map((destination) => (
                <option key={destination.id} value={destination.id}>
                  {destination.name}
                </option>
              ))}
            </select>
          </label>
          <p className="-mt-2 text-xs text-gray-500">A venue, a destination, or both is required.</p>

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
