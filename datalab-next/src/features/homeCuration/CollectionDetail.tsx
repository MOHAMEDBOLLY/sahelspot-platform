import { useState, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ChevronRight, GripVertical, Pencil } from 'lucide-react'
import { fetchCollection, removeCollectionVenue, reorderCollectionVenue, updateCollection } from './api'
import { AddCollectionVenueDialog } from './AddCollectionVenueDialog'
import { isHomeCurationSlug } from './constants'
import { LoadingState } from '../../components/LoadingState'
import { ErrorState } from '../../components/ErrorState'
import type { CollectionVenue } from '../../types/homeCuration'

type CollectionDetailProps = {
  collectionId: string
  onBack: () => void
}

/** HOME CURATION. List + detail within one page via local selection
 * state — same established pattern `pages/Events.tsx`/`pages/NoQr.tsx`
 * already use. Venue reorder uses the same plain HTML5 drag-and-drop
 * technique as `ImagesSection.tsx`'s gallery reorder — no new library.
 *
 * SCOPE CORRECTION — guarded a second time here, not just by the caller
 * (`pages/HomeCuration.tsx`): `isAllowed` gates the query itself
 * (`enabled`), so an unapproved `collectionId` never even fetches, let
 * alone renders a working editor for one of the 7 unrelated production
 * collections. */
export function CollectionDetail({ collectionId, onBack }: CollectionDetailProps) {
  const isAllowed = isHomeCurationSlug(collectionId)
  const queryClient = useQueryClient()
  const { data: collection, isPending, isError, error, refetch } = useQuery({
    queryKey: ['collections', collectionId],
    queryFn: () => fetchCollection(collectionId),
    enabled: isAllowed,
  })
  const [isEditingName, setIsEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [draggedVenueId, setDraggedVenueId] = useState<string | null>(null)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['collections', collectionId] })
    queryClient.invalidateQueries({ queryKey: ['collections'] })
  }

  const { mutate: saveName, isPending: isSavingName } = useMutation({
    mutationFn: (name: string) => updateCollection(collectionId, { name }),
    onSuccess: () => {
      invalidate()
      setIsEditingName(false)
    },
  })

  const { mutate: toggleActive } = useMutation({
    mutationFn: (isActive: boolean) => updateCollection(collectionId, { is_active: isActive }),
    onSuccess: invalidate,
  })

  const { mutate: removeVenue, isPending: isRemoving } = useMutation({
    mutationFn: (venueId: string) => removeCollectionVenue(collectionId, venueId),
    onSuccess: invalidate,
  })

  const { mutate: reorderVenue } = useMutation({
    mutationFn: ({ venueId, sortOrder }: { venueId: string; sortOrder: number }) =>
      reorderCollectionVenue(collectionId, venueId, sortOrder),
    onSuccess: invalidate,
  })

  if (!isAllowed) {
    return (
      <ErrorState message={`"${collectionId}" is not a Home Curation section.`} onRetry={onBack} />
    )
  }
  if (isPending) return <LoadingState label="Loading section…" />
  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'Failed to load section.'}
        onRetry={refetch}
      />
    )
  }

  const existingVenueIds = new Set(collection.venues.map((v) => v.venue_id))

  // Plain HTML5 drag-and-drop, same technique as ImagesSection.tsx's
  // gallery reorder — no new dependency. Dropping onto another row moves
  // the dragged venue to that position and persists every row's new
  // `sort_order` in sequence.
  function handleDragStart(venueId: string) {
    setDraggedVenueId(venueId)
  }

  function handleDragOver(event: DragEvent<HTMLLIElement>) {
    event.preventDefault()
  }

  function handleDrop(targetVenueId: string) {
    if (!draggedVenueId || draggedVenueId === targetVenueId || !collection) {
      setDraggedVenueId(null)
      return
    }
    const ids = collection.venues.map((v) => v.venue_id)
    const withoutDragged = ids.filter((id) => id !== draggedVenueId)
    const targetIndex = withoutDragged.indexOf(targetVenueId)
    const reordered = [...withoutDragged.slice(0, targetIndex), draggedVenueId, ...withoutDragged.slice(targetIndex)]
    setDraggedVenueId(null)
    reordered.forEach((venueId, index) => {
      const current = collection.venues.find((v) => v.venue_id === venueId)
      if (current && current.sort_order !== index) {
        reorderVenue({ venueId, sortOrder: index })
      }
    })
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto">
      <button
        type="button"
        onClick={onBack}
        className="flex w-fit items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft size={14} />
        Back to Home Curation
      </button>

      <div className="flex items-center justify-between gap-4">
        {isEditingName ? (
          <div className="flex flex-1 items-center gap-2">
            <input
              type="text"
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              className="min-h-11 flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-lg font-semibold text-gray-900 uppercase focus:border-gray-900 focus:outline-none lg:min-h-0"
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
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-wide text-gray-900 uppercase">
            {collection.name}
            <button
              type="button"
              onClick={() => {
                setNameDraft(collection.name)
                setIsEditingName(true)
              }}
              className="text-gray-400 hover:text-gray-900"
              aria-label="Edit name"
            >
              <Pencil size={16} />
            </button>
          </h1>
        )}

        <label className="flex shrink-0 items-center gap-2 text-sm font-medium text-gray-700">
          {collection.is_active ? 'On' : 'Off'}
          <input
            type="checkbox"
            checked={collection.is_active}
            onChange={(event) => toggleActive(event.target.checked)}
            className="h-5 w-9 accent-gray-900"
          />
        </label>
      </div>

      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold tracking-wide text-gray-500 uppercase">
          Venues ({collection.venues.length})
        </h2>
        <AddCollectionVenueDialog collectionId={collectionId} existingVenueIds={existingVenueIds} />
      </div>

      {collection.venues.length === 0 ? (
        <p className="text-sm text-gray-400">No venues yet.</p>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white">
          <ul className="divide-y divide-gray-100">
            {collection.venues.map((membership: CollectionVenue, index: number) => (
              <li
                key={membership.venue_id}
                draggable
                onDragStart={() => handleDragStart(membership.venue_id)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(membership.venue_id)}
                className={draggedVenueId === membership.venue_id ? 'opacity-40' : ''}
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  <GripVertical size={16} className="shrink-0 cursor-grab text-gray-300" />
                  <span className="w-5 shrink-0 text-xs text-gray-400">{index + 1}.</span>
                  {membership.venue ? (
                    <Link
                      to={`/venues?q=${encodeURIComponent(membership.venue.name)}`}
                      className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium text-gray-900 hover:text-blue-600"
                    >
                      <span className="truncate">{membership.venue.name}</span>
                      <ChevronRight size={14} className="shrink-0 text-gray-300" />
                    </Link>
                  ) : (
                    <span className="flex-1 text-sm text-gray-400 italic">Venue no longer exists</span>
                  )}
                  <button
                    type="button"
                    disabled={isRemoving}
                    onClick={() => removeVenue(membership.venue_id)}
                    className="shrink-0 rounded-lg border border-gray-200 px-2 py-1 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
