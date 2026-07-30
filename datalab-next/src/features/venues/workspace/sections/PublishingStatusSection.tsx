import { UploadCloud } from 'lucide-react'
import type { Venue } from '../../../../types/venue'
import { WorkspaceSection } from '../../../../components/workspace/WorkspaceSection'
import { WorkspaceField } from '../../../../components/workspace/WorkspaceField'
import { TextAreaField } from '../../../../components/workspace/fields/TextAreaField'
import { StatusBadge } from '../../../../components/StatusBadge'
import { formatDateTime } from '../../../../lib/formatDate'
import type { WorkspaceMode } from '../../../../components/workspace/types'
import type { FieldErrors } from '../../../../lib/validation'

type PublishingStatusSectionProps = {
  venue: Venue
  mode: WorkspaceMode
  onFieldChange: <K extends keyof Venue>(field: K, value: Venue[K]) => void
  errors?: FieldErrors
}

export function PublishingStatusSection({
  venue,
  mode,
  onFieldChange,
  errors = {},
}: PublishingStatusSectionProps) {
  return (
    <WorkspaceSection title="Publishing Status" icon={UploadCloud}>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Status is workflow-controlled (see docs/ARCHITECTURE.md#publishing-architecture) —
            it changes via Review/Publish actions, not a free-form field edit. Always read-only. */}
        <WorkspaceField label="Status" value={<StatusBadge status={venue.status} />} />
        <WorkspaceField
          label="Last Published"
          value={formatDateTime(venue.last_published_at) ?? 'Never published'}
        />
        <WorkspaceField label="Created" value={formatDateTime(venue.created_at)} />
        <WorkspaceField label="Updated" value={formatDateTime(venue.updated_at)} />
        <WorkspaceField label="Source" value={venue.source} />
      </dl>
      <div className="mt-4">
        {mode === 'view' ? (
          <WorkspaceField label="Internal Notes" value={venue.internal_notes} />
        ) : (
          <TextAreaField
            label="Internal Notes"
            value={venue.internal_notes ?? ''}
            onChange={(v) => onFieldChange('internal_notes', v)}
            error={errors.internal_notes}
          />
        )}
      </div>
    </WorkspaceSection>
  )
}
