import { UploadCloud } from 'lucide-react'
import type { Event } from '../../../../types/event'
import { WorkspaceSection } from '../../../../components/workspace/WorkspaceSection'
import { WorkspaceField } from '../../../../components/workspace/WorkspaceField'
import { StatusBadge } from '../../../../components/StatusBadge'
import { formatDateTime } from '../../../../lib/formatDate'

type EventPublishingStatusSectionProps = {
  event: Event
}

/** Entirely read-only, same reasoning as destinations'
 * `PublishingStatusSection`. `phase` (Upcoming/Live/Ended) is shown here
 * too — it's a computed fact about the event, same read-only class as
 * `status`, never something Edit Mode sets directly. */
export function EventPublishingStatusSection({ event }: EventPublishingStatusSectionProps) {
  return (
    <WorkspaceSection title="Publishing Status" icon={UploadCloud}>
      <dl className="grid grid-cols-2 gap-4">
        <WorkspaceField label="Status" value={<StatusBadge status={event.status} />} />
        <WorkspaceField label="Phase" value={event.phase} />
        <WorkspaceField label="Last Published" value={formatDateTime(event.last_published_at) ?? 'Never published'} />
        <WorkspaceField label="Created" value={formatDateTime(event.created_at)} />
        <WorkspaceField label="Updated" value={formatDateTime(event.updated_at)} />
      </dl>
    </WorkspaceSection>
  )
}
