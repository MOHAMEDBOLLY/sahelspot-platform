import { Pencil, X } from 'lucide-react'
import type { WorkspaceMode } from './types'

type WorkspaceToolbarProps = {
  venueName: string
  mode: WorkspaceMode
  onEdit: () => void
  onCancel: () => void
}

/**
 * Mode switch only — no Save here yet. Save arrives once mutations exist
 * (see the "how this evolves" note in the Sprint 9 summary); this toolbar's
 * job right now is strictly View <-> Edit.
 */
export function WorkspaceToolbar({ venueName, mode, onEdit, onCancel }: WorkspaceToolbarProps) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="truncate text-lg font-semibold text-gray-900">{venueName}</h2>
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
