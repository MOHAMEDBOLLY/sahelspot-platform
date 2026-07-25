import type { ReactNode } from 'react'
import { Loader2, Pencil, Save, X } from 'lucide-react'
import type { WorkspaceMode } from './types'

type DraftToolbarProps = {
  title: string
  mode: WorkspaceMode
  isDirty: boolean
  isSaving: boolean
  saveError: string | null
  hasFieldErrors?: boolean
  /** Sprint 24 — whether the caller's role grants `content_edit`.
   * Defaults to `true` (every pre-Sprint-24 caller keeps working
   * unchanged). Hides the Edit button entirely rather than showing it
   * disabled — a `viewer` has no path into edit mode at all, not a
   * blocked one. The backend re-enforces this independently
   * (`PATCH`/`Validate` require `Permission.CONTENT_EDIT`); this only
   * controls what renders. */
  canEdit?: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: () => void
  /** Entity-specific action buttons (e.g. Venue's Validate/Submit for
   * Review/Approve) rendered before the Edit/Cancel/Save Draft group.
   * Omit for entities with no extra workflow actions yet. */
  extraActions?: ReactNode
  /** Additional inline status/error text next to the dirty indicator (e.g.
   * Venue's Submit for Review / Approve errors). */
  extraStatus?: ReactNode
}

/** The Edit/Cancel/Save Draft shell every entity workspace shares —
 * extracted in Sprint 21 when Destinations became the second consumer of
 * the pattern Venues established in Sprints 9–12. Entity-specific actions
 * (Venue's Validate/Submit for Review/Approve) plug in via `extraActions`
 * rather than this component knowing about any one entity's workflow. */
export function DraftToolbar({
  title,
  mode,
  isDirty,
  isSaving,
  saveError,
  hasFieldErrors = false,
  canEdit = true,
  onEdit,
  onCancel,
  onSave,
  extraActions,
  extraStatus,
}: DraftToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-2">
        <h2 className="truncate text-lg font-semibold text-gray-900">{title}</h2>
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
        {extraStatus}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {extraActions}
        {mode === 'view' ? (
          canEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-700"
            >
              <Pencil size={14} />
              Edit
            </button>
          )
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
