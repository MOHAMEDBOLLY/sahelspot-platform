import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ChevronRight, Pencil, X } from 'lucide-react'
import { fetchNoQrArea, removeNoQrPlace, renameNoQrArea, renameNoQrPlace } from './api'
import { AddPlaceDialog } from './AddPlaceDialog'
import { LoadingState } from '../../components/LoadingState'
import { ErrorState } from '../../components/ErrorState'
import type { NoQrPlace } from '../../types/noQrArea'

type NoQrAreaDetailProps = {
  areaId: number
  onBack: () => void
}

/** STUDIO — NO QR INDEPENDENT ENTITY (Phase 1). List + detail within one
 * page via local selection state — same established pattern
 * `pages/Events.tsx` already uses for `EventWorkspace`, not a separate
 * route per Area. */
export function NoQrAreaDetail({ areaId, onBack }: NoQrAreaDetailProps) {
  const queryClient = useQueryClient()
  const { data: area, isPending, isError, error, refetch } = useQuery({
    queryKey: ['no-qr-areas', areaId],
    queryFn: () => fetchNoQrArea(areaId),
  })
  const [isEditingName, setIsEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [editingPlaceId, setEditingPlaceId] = useState<number | null>(null)
  const [placeNameDraft, setPlaceNameDraft] = useState('')

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['no-qr-areas', areaId] })
    queryClient.invalidateQueries({ queryKey: ['no-qr-areas'] })
  }

  const { mutate: saveName, isPending: isSavingName } = useMutation({
    mutationFn: (name: string) => renameNoQrArea(areaId, name),
    onSuccess: () => {
      invalidate()
      setIsEditingName(false)
    },
  })

  const { mutate: savePlaceName, isPending: isSavingPlaceName } = useMutation({
    mutationFn: ({ placeId, name }: { placeId: number; name: string }) => renameNoQrPlace(placeId, name),
    onSuccess: () => {
      invalidate()
      setEditingPlaceId(null)
    },
  })

  const { mutate: removePlace, isPending: isRemoving } = useMutation({
    mutationFn: (placeId: number) => removeNoQrPlace(placeId),
    onSuccess: invalidate,
  })

  if (isPending) return <LoadingState label="Loading Area…" />
  if (isError) {
    return (
      <ErrorState message={error instanceof Error ? error.message : 'Failed to load Area.'} onRetry={refetch} />
    )
  }

  const existingVenueIds = new Set(area.places.map((place) => place.venue_id).filter((id): id is string => !!id))

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto">
      <button
        type="button"
        onClick={onBack}
        className="flex w-fit items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft size={14} />
        Back to No QR
      </button>

      <div className="flex items-center justify-between gap-4">
        {isEditingName ? (
          <div className="flex flex-1 items-center gap-2">
            <input
              type="text"
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              className="min-h-11 flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-lg font-semibold text-gray-900 focus:border-gray-900 focus:outline-none lg:min-h-0"
              autoFocus
            />
            <button
              type="button"
              disabled={isSavingName}
              onClick={() => saveName(nameDraft)}
              className="min-h-11 rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 lg:min-h-0"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setIsEditingName(false)}
              className="min-h-11 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 lg:min-h-0"
            >
              Cancel
            </button>
          </div>
        ) : (
          <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
            {area.name}
            <button
              type="button"
              onClick={() => {
                setNameDraft(area.name)
                setIsEditingName(true)
              }}
              className="text-gray-400 hover:text-gray-900"
              aria-label="Edit name"
            >
              <Pencil size={16} />
            </button>
          </h1>
        )}
      </div>

      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold tracking-wide text-gray-500 uppercase">
          Places ({area.places.length})
        </h2>
        <AddPlaceDialog areaId={areaId} existingVenueIds={existingVenueIds} />
      </div>

      {area.places.length === 0 ? (
        <p className="text-sm text-gray-400">No Places yet.</p>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white">
          <ul className="divide-y divide-gray-100">
            {area.places.map((place) => (
              <li key={place.id}>
                <PlaceRow
                  place={place}
                  isEditing={editingPlaceId === place.id}
                  nameDraft={placeNameDraft}
                  onStartEdit={() => {
                    setEditingPlaceId(place.id)
                    setPlaceNameDraft(place.name ?? '')
                  }}
                  onChangeDraft={setPlaceNameDraft}
                  onSaveEdit={() => savePlaceName({ placeId: place.id, name: placeNameDraft })}
                  onCancelEdit={() => setEditingPlaceId(null)}
                  onRemove={() => removePlace(place.id)}
                  isSaving={isSavingPlaceName}
                  isRemoving={isRemoving}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function PlaceRow({
  place,
  isEditing,
  nameDraft,
  onStartEdit,
  onChangeDraft,
  onSaveEdit,
  onCancelEdit,
  onRemove,
  isSaving,
  isRemoving,
}: {
  place: NoQrPlace
  isEditing: boolean
  nameDraft: string
  onStartEdit: () => void
  onChangeDraft: (value: string) => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onRemove: () => void
  isSaving: boolean
  isRemoving: boolean
}) {
  if (place.venue) {
    // Existing Venue place — the Venue remains the source of truth for
    // its own data; this row only links to it, never duplicates or
    // independently edits it (per the approved Phase 1 UX).
    return (
      <div className="flex items-center gap-3 px-4 py-3">
        <Link
          to={`/venues?q=${encodeURIComponent(place.venue.name)}`}
          className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium text-gray-900 hover:text-blue-600"
        >
          <span className="truncate">{place.venue.name}</span>
          <span className="shrink-0 text-xs font-normal text-gray-400">Existing Venue</span>
          <ChevronRight size={14} className="shrink-0 text-gray-300" />
        </Link>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {isEditing ? (
        <div className="flex flex-1 items-center gap-2">
          <input
            type="text"
            value={nameDraft}
            onChange={(event) => onChangeDraft(event.target.value)}
            className="min-h-11 flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none lg:min-h-0"
            autoFocus
          />
          <button
            type="button"
            disabled={isSaving}
            onClick={onSaveEdit}
            className="min-h-11 rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 lg:min-h-0"
          >
            Save
          </button>
          <button
            type="button"
            onClick={onCancelEdit}
            className="min-h-11 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 lg:min-h-0"
          >
            Cancel
          </button>
        </div>
      ) : (
        <>
          <div className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium text-gray-900">
            <span className="truncate">{place.name}</span>
            <span className="shrink-0 text-xs font-normal text-gray-400">Standalone Place</span>
          </div>
          <button
            type="button"
            onClick={onStartEdit}
            className="shrink-0 text-gray-400 hover:text-gray-900"
            aria-label="Edit place name"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            disabled={isRemoving}
            onClick={onRemove}
            className="shrink-0 text-gray-400 hover:text-red-600 disabled:opacity-50"
            aria-label="Remove place"
          >
            <X size={14} />
          </button>
        </>
      )}
    </div>
  )
}
