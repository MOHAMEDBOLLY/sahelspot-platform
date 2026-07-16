import { Info } from 'lucide-react'
import type { Venue } from '../../../../types/venue'
import { WorkspaceSection } from '../WorkspaceSection'
import { WorkspaceField } from '../WorkspaceField'

type BasicInfoSectionProps = {
  venue: Venue
}

export function BasicInfoSection({ venue }: BasicInfoSectionProps) {
  return (
    <WorkspaceSection title="Basic Information" icon={Info}>
      <dl className="grid grid-cols-2 gap-4">
        <WorkspaceField label="Name" value={venue.name} />
        <WorkspaceField label="Slug" value={venue.slug} />
        <WorkspaceField label="Category" value={venue.category} />
        <WorkspaceField label="Destination" value={venue.destination.name} />
        <WorkspaceField label="District" value={venue.district} />
        <WorkspaceField label="Featured" value={venue.is_featured ? 'Yes' : 'No'} />
        <WorkspaceField label="Verified" value={venue.is_verified ? 'Yes' : 'No'} />
      </dl>
      <div className="mt-4">
        <WorkspaceField label="Short Description" value={venue.short_description} />
      </div>
    </WorkspaceSection>
  )
}
