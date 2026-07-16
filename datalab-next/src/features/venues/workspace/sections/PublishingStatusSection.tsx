import { UploadCloud } from 'lucide-react'
import type { Venue } from '../../../../types/venue'
import { WorkspaceSection } from '../WorkspaceSection'
import { WorkspaceField } from '../WorkspaceField'
import { StatusBadge } from '../../../../components/StatusBadge'
import { formatDateTime } from '../../../../lib/formatDate'

type PublishingStatusSectionProps = {
  venue: Venue
}

export function PublishingStatusSection({ venue }: PublishingStatusSectionProps) {
  return (
    <WorkspaceSection title="Publishing Status" icon={UploadCloud}>
      <dl className="grid grid-cols-2 gap-4">
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
        <WorkspaceField label="Internal Notes" value={venue.internal_notes} />
      </div>
    </WorkspaceSection>
  )
}
