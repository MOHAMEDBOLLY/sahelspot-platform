import { useEffect } from 'react'
import { MapPinOff } from 'lucide-react'
import { useDestination } from '../useDestination'
import { useUpdateDestination } from '../useUpdateDestination'
import { toDestinationPatch } from '../api'
import { validateDestinationDraft } from '../destinationValidation'
import { ApiError } from '../../../lib/apiClient'
import { useDraft } from '../../../hooks/useDraft'
import { LoadingState } from '../../../components/LoadingState'
import { ErrorState } from '../../../components/ErrorState'
import { PagePlaceholder } from '../../../components/PagePlaceholder'
import { DraftToolbar } from '../../../components/workspace/DraftToolbar'
import { useAuth } from '../../auth/useAuth'
import { hasPermission } from '../../auth/permissions'
import { BasicInfoSection } from './sections/BasicInfoSection'
import { PublishingStatusSection } from './sections/PublishingStatusSection'
import type { Destination } from '../../../types/destination'

type DestinationWorkspaceProps = {
  destinationId: string | null
  onDirtyChange?: (isDirty: boolean) => void
}

/**
 * The Destination Workspace — Sprint 21's proof that the editorial
 * architecture Sprints 9–12 built for Venues (Edit Mode, `useDraft`,
 * Save Draft, frontend UX validation) generalizes to a second entity
 * without forking it. Deliberately simpler than `VenueWorkspace`: no
 * Validate/Submit for Review/Approve, since no Editorial Readiness or
 * workflow endpoints exist for destinations yet (out of this sprint's
 * scope) — so this uses `DraftToolbar` directly, with no entity-specific
 * wrapper toolbar the way Venue's `WorkspaceToolbar` needs one.
 */
export function DestinationWorkspace({ destinationId, onDirtyChange }: DestinationWorkspaceProps) {
  const { data: destination, isPending, isError, error, refetch } = useDestination(destinationId)
  const {
    mode,
    value: displayedDestination,
    isDirty,
    startEditing,
    cancelEditing,
    commitSave,
    updateField,
  } = useDraft<Destination>(destination, destinationId)
  const { mutate: saveDraft, isPending: isSaving, error: saveError, reset: resetSaveError } =
    useUpdateDestination()
  const { role } = useAuth()
  const canEdit = hasPermission(role, 'content_edit')

  const fieldErrors =
    mode === 'edit' && displayedDestination ? validateDestinationDraft(displayedDestination) : {}
  const hasFieldErrors = Object.keys(fieldErrors).length > 0

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  function handleCancel() {
    resetSaveError()
    cancelEditing()
  }

  function handleFieldChange<K extends keyof Destination>(field: K, value: Destination[K]) {
    updateField(field, value)
  }

  function handleSave() {
    if (!destinationId || !displayedDestination) return
    saveDraft(
      { id: destinationId, patch: toDestinationPatch(displayedDestination) },
      { onSuccess: commitSave },
    )
  }

  if (!destinationId) {
    return (
      <PagePlaceholder
        icon={MapPinOff}
        title="No destination selected"
        description="Select a destination from the list to view its details."
      />
    )
  }

  if (isPending) {
    return <LoadingState label="Loading destination…" />
  }

  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'Failed to load destination.'}
        onRetry={() => refetch()}
      />
    )
  }

  if (!displayedDestination) {
    return null
  }

  return (
    <div className="flex flex-col gap-4">
      <DraftToolbar
        title={displayedDestination.name}
        mode={mode}
        isDirty={isDirty}
        isSaving={isSaving}
        saveError={saveError instanceof ApiError ? saveError.message : saveError ? 'Failed to save.' : null}
        hasFieldErrors={hasFieldErrors}
        canEdit={canEdit}
        onEdit={startEditing}
        onCancel={handleCancel}
        onSave={handleSave}
      />
      <BasicInfoSection
        destination={displayedDestination}
        mode={mode}
        onFieldChange={handleFieldChange}
        errors={fieldErrors}
      />
      <PublishingStatusSection destination={displayedDestination} />
    </div>
  )
}
