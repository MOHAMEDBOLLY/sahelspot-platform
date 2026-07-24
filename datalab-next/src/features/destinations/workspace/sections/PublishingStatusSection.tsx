import { UploadCloud } from 'lucide-react'
import type { Destination } from '../../../../types/destination'
import { WorkspaceSection } from '../../../../components/workspace/WorkspaceSection'
import { WorkspaceField } from '../../../../components/workspace/WorkspaceField'
import { StatusBadge } from '../../../../components/StatusBadge'
import { formatDateTime } from '../../../../lib/formatDate'

type PublishingStatusSectionProps = {
  destination: Destination
}

/** Entirely read-only, same reasoning as the Venue Workspace's own
 * Publishing Status section: `status` is workflow-controlled (no Review/
 * Approval exists for destinations yet, but it still isn't a generic text
 * field a draft edit should be able to change), and the timestamps are
 * system-managed. No `mode`/`onFieldChange` props — there is nothing in
 * this section Edit Mode would ever make editable. */
export function PublishingStatusSection({ destination }: PublishingStatusSectionProps) {
  return (
    <WorkspaceSection title="Publishing Status" icon={UploadCloud}>
      <dl className="grid grid-cols-2 gap-4">
        <WorkspaceField label="Status" value={<StatusBadge status={destination.status} />} />
        <WorkspaceField
          label="Last Published"
          value={formatDateTime(destination.last_published_at) ?? 'Never published'}
        />
        <WorkspaceField label="Created" value={formatDateTime(destination.created_at)} />
        <WorkspaceField label="Updated" value={formatDateTime(destination.updated_at)} />
        <WorkspaceField label="Boundary" value={destination.boundary ? 'Set' : null} />
      </dl>
    </WorkspaceSection>
  )
}
