import { Pencil, X } from 'lucide-react'
import type { WorkspaceMode } from './types'

type WorkspaceToolbarProps = {
  venueName: string
  mode: WorkspaceMode
  isDirty: boolean
  onEdit: () => void
  onCancel: () => void
}

/**
 * Mode switch only — no Save here yet. Save arrives once mutations exist
 * (see the "how this evolves" note in the Sprint 9/10 summaries); this
 * toolbar's job right now is View <-> Edit plus surfacing dirty state.
 */
export function WorkspaceToolbar({ venueName, mode, isDirty, onEdit, onCancel }: WorkspaceToolbarProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <h2 className="truncate text-lg font-semibold text-gray-900">{venueName}</h2>
        {mode === 'edit' && isDirty && (
          <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Unsaved changes
          </span>
        )}
      </div>
      {mode === 'view' ? (
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-700"
        >
          <Pencil size={14} />
          Edit
        </button>
      ) : (
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          <X size={14} />
          Cancel
        </button>
      )}
    </div>
  )
}
