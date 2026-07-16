import { CheckCheck, Loader2, Pencil, Save, X } from 'lucide-react'
import type { WorkspaceMode } from './types'

type WorkspaceToolbarProps = {
  venueName: string
  mode: WorkspaceMode
  isDirty: boolean
  isSaving: boolean
  saveError: string | null
  hasFieldErrors: boolean
  isValidating: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: () => void
  onValidate: () => void
}

export function WorkspaceToolbar({
  venueName,
  mode,
  isDirty,
  isSaving,
  saveError,
  hasFieldErrors,
  isValidating,
  onEdit,
  onCancel,
  onSave,
  onValidate,
}: WorkspaceToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-2">
        <h2 className="truncate text-lg font-semibold text-gray-900">{venueName}</h2>
        {mode === 'edit' && isDirty && !isSaving && (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Unsaved changes
          </span>
        )}
        {saveError && (
          <span className="truncate text-xs font-medium text-red-600" title={saveError}>
            {saveError}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onValidate}
          disabled={isValidating || isDirty}
          title={isDirty ? 'Save Draft first — Validate checks the saved state, not unsaved edits.' : undefined}
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isValidating ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={14} />}
          {isValidating ? 'Validating…' : 'Validate'}
        </button>
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
          <>
            <button
              type="button"
              onClick={onCancel}
              disabled={isSaving}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X size={14} />
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={!isDirty || isSaving || hasFieldErrors}
              title={hasFieldErrors ? 'Fix the highlighted fields before saving.' : undefined}
              className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {isSaving ? 'Saving…' : 'Save Draft'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
