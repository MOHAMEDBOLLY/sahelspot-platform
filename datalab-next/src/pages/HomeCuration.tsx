import { useMemo, useState, type DragEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, GripVertical, LayoutGrid } from 'lucide-react'
import { fetchCollections, updateCollection } from '../features/homeCuration/api'
import { CollectionDetail } from '../features/homeCuration/CollectionDetail'
import { isHomeCurationSlug } from '../features/homeCuration/constants'
import { LoadingState } from '../components/LoadingState'
import { ErrorState } from '../components/ErrorState'
import type { Collection } from '../types/homeCuration'

/** HOME CURATION. Lets an editor control exactly what appears on the
 * Consumer Home page — extends the existing `Collection`/
 * `CollectionVenue` model (see api/app/db/models.py, unchanged) rather
 * than a new schema, per the approved architecture audit.
 *
 * SCOPE CORRECTION — `Collection` also holds 7 pre-existing, unrelated
 * production rows (`editors-choice`, `trending`, ... — seeded by
 * migration 0015, long before this feature existed). This screen filters
 * `GET /editor/collections`' full result down to `HOME_CURATION_SLUGS`
 * (`features/homeCuration/constants.ts`) before rendering anything —
 * those 7 rows are never listed, never draggable, never toggleable, and
 * never openable from here. The generic Collection API itself is
 * deliberately left as-is (other Studio surfaces may reasonably manage
 * the rest of the catalog later); the restriction lives entirely in this
 * feature's own UI layer, which is the only thing that needed to change.
 *
 * List + detail within one page via local selection state — same
 * established pattern `pages/Events.tsx`/`pages/NoQr.tsx` already use.
 * Section reorder uses the same plain HTML5 drag-and-drop technique as
 * `ImagesSection.tsx`'s gallery reorder — no new library. */
export function HomeCuration() {
  const queryClient = useQueryClient()
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const { data: allCollections, isPending, isError, error, refetch } = useQuery({
    queryKey: ['collections'],
    queryFn: fetchCollections,
  })

  // The one filter point — every row this screen ever renders, drags, or
  // mutates comes from this array, never from `allCollections` directly.
  const collections = useMemo(
    () => allCollections?.filter((c) => isHomeCurationSlug(c.id)),
    [allCollections],
  )

  const { mutate: toggleActive } = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateCollection(id, { is_active: isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['collections'] }),
  })

  const { mutate: reorder } = useMutation({
    mutationFn: ({ id, sortOrder }: { id: string; sortOrder: number }) =>
      updateCollection(id, { sort_order: sortOrder }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['collections'] }),
  })

  if (selectedCollectionId !== null) {
    // Defense in depth: `setSelectedCollectionId` is only ever called
    // below with an id already drawn from the filtered `collections`
    // array, so this branch is unreachable through the UI today — but if
    // that ever changes (e.g. a future deep link), an unapproved id must
    // still show a clear invalid state, never the generic editor.
    if (!isHomeCurationSlug(selectedCollectionId)) {
      return (
        <ErrorState
          message={`"${selectedCollectionId}" is not a Home Curation section.`}
          onRetry={() => setSelectedCollectionId(null)}
        />
      )
    }
    return <CollectionDetail collectionId={selectedCollectionId} onBack={() => setSelectedCollectionId(null)} />
  }

  if (isPending) return <LoadingState label="Loading Home Curation…" />
  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'Failed to load Home Curation sections.'}
        onRetry={refetch}
      />
    )
  }
  if (!collections) return null

  // Plain HTML5 drag-and-drop, same technique as ImagesSection.tsx's
  // gallery reorder — no new dependency. Dropping onto another row moves
  // the dragged section to that position and persists every row's new
  // `sort_order` in sequence.
  function handleDragStart(id: string) {
    setDraggedId(id)
  }

  function handleDragOver(event: DragEvent<HTMLLIElement>) {
    event.preventDefault()
  }

  function handleDrop(targetId: string) {
    if (!draggedId || draggedId === targetId || !collections) {
      setDraggedId(null)
      return
    }
    const ids = collections.map((c) => c.id)
    const withoutDragged = ids.filter((id) => id !== draggedId)
    const targetIndex = withoutDragged.indexOf(targetId)
    const reordered = [...withoutDragged.slice(0, targetIndex), draggedId, ...withoutDragged.slice(targetIndex)]
    setDraggedId(null)
    reordered.forEach((id, index) => {
      const current = collections.find((c) => c.id === id)
      if (current && current.sort_order !== index) {
        reorder({ id, sortOrder: index })
      }
    })
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
          <LayoutGrid size={22} className="text-gray-500" />
          Home Curation
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Control exactly what appears on the Consumer Home page — sections and their venues.
        </p>
      </div>

      {collections.length === 0 ? (
        <p className="text-sm text-gray-400">No sections yet.</p>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white">
          <ul className="divide-y divide-gray-100">
            {collections.map((collection: Collection, index: number) => (
              <li
                key={collection.id}
                draggable
                onDragStart={() => handleDragStart(collection.id)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(collection.id)}
                className={draggedId === collection.id ? 'opacity-40' : ''}
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  <GripVertical size={16} className="shrink-0 cursor-grab text-gray-300" />
                  <span className="w-5 shrink-0 text-xs text-gray-400">{index + 1}.</span>
                  <button
                    type="button"
                    onClick={() => setSelectedCollectionId(collection.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-medium text-gray-900 hover:text-blue-600"
                  >
                    <span className="truncate">{collection.name}</span>
                    <span className="shrink-0 text-xs font-normal text-gray-400">
                      {collection.venues.length} venues
                    </span>
                  </button>
                  <label className="flex shrink-0 items-center gap-2 text-xs font-medium text-gray-500">
                    {collection.is_active ? 'On' : 'Off'}
                    <input
                      type="checkbox"
                      checked={collection.is_active}
                      onChange={(event) => toggleActive({ id: collection.id, isActive: event.target.checked })}
                      className="h-4 w-8 accent-gray-900"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setSelectedCollectionId(collection.id)}
                    className="shrink-0 rounded-lg border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Open
                    <ChevronRight size={12} className="ml-0.5 inline" />
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
