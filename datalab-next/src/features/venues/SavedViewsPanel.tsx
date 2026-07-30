import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bookmark, Star, Trash2, X } from 'lucide-react'
import { deleteSavedView, listSavedViews, saveSavedView, type SavedView } from '../../lib/savedViews'

type SavedViewsPanelProps = {
  userId: string
  /** The Venue List's current URL params, as a plain object — exactly
   * what gets persisted when "Save current search" is used. Owned by
   * `pages/Venues.tsx`, never re-derived here. */
  currentParams: Record<string, string>
}

/**
 * Lists saved filter presets and lets an editor save the current search.
 * "Opening" a view is a plain `<Link>` to `/venues?<params>` — the exact
 * same URL-driven restoration every other filter/drill-down in this app
 * already uses, not a second mechanism.
 */
export function SavedViewsPanel({ userId, currentParams }: SavedViewsPanelProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [name, setName] = useState('')
  const [views, setViews] = useState<SavedView[]>(() => listSavedViews(userId))

  const hasActiveFilters = Object.keys(currentParams).length > 0

  function refresh() {
    setViews(listSavedViews(userId))
  }

  function openSaveDialog() {
    setName('')
    dialogRef.current?.showModal()
  }

  function handleSave() {
    if (!name.trim()) return
    saveSavedView(userId, { name: name.trim(), params: currentParams })
    refresh()
    dialogRef.current?.close()
  }

  function handleDelete(viewId: string) {
    deleteSavedView(userId, viewId)
    refresh()
  }

  function viewHref(view: SavedView): string {
    const query = new URLSearchParams(view.params).toString()
    return query ? `/venues?${query}` : '/venues'
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">
          <Bookmark size={12} />
          Saved Views
        </h3>
        <button
          type="button"
          onClick={openSaveDialog}
          disabled={!hasActiveFilters}
          className="text-xs font-medium text-gray-700 underline hover:text-gray-900 disabled:cursor-not-allowed disabled:text-gray-300 disabled:no-underline"
        >
          Save current search
        </button>
      </div>

      {views.length === 0 ? (
        <p className="text-xs text-gray-400">No saved views yet.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {views.map((view) => (
            <li key={view.id} className="flex items-center justify-between gap-1">
              <Link
                to={viewHref(view)}
                className="flex min-w-0 flex-1 items-center gap-1.5 truncate rounded-lg px-2 py-1 text-sm text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gray-900"
              >
                <Star size={12} className="shrink-0 text-gray-400" />
                <span className="truncate">{view.name}</span>
              </Link>
              <button
                type="button"
                onClick={() => handleDelete(view.id)}
                aria-label={`Delete saved view "${view.name}"`}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gray-900"
              >
                <Trash2 size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <dialog
        ref={dialogRef}
        className="w-full max-w-xs rounded-xl border border-gray-200 p-0 backdrop:bg-black/40"
      >
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Save current search</h2>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="text-gray-400 hover:text-gray-900"
            >
              <X size={16} />
            </button>
          </div>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Name
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Missing Covers"
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
              autoFocus
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!name.trim()}
              className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      </dialog>
    </div>
  )
}
