import { MapPin } from 'lucide-react'
import type { Venue } from '../../../../types/venue'
import { WorkspaceSection } from '../WorkspaceSection'
import { WorkspaceField } from '../WorkspaceField'

type LocationSectionProps = {
  venue: Venue
}

export function LocationSection({ venue }: LocationSectionProps) {
  return (
    <WorkspaceSection title="Location" icon={MapPin}>
      <dl className="grid grid-cols-2 gap-4">
        <WorkspaceField label="Latitude" value={venue.latitude} />
        <WorkspaceField label="Longitude" value={venue.longitude} />
        <div className="col-span-2">
          <WorkspaceField
            label="Maps Link"
            value={
              venue.maps_url ? (
                <a
                  href={venue.maps_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {venue.maps_url}
                </a>
              ) : null
            }
          />
        </div>
      </dl>
    </WorkspaceSection>
  )
}
