import { MapPin } from 'lucide-react'
import type { Venue } from '../../../../types/venue'
import { WorkspaceSection } from '../WorkspaceSection'
import { WorkspaceField } from '../WorkspaceField'
import { TextField } from '../fields/TextField'
import type { WorkspaceMode } from '../types'

type LocationSectionProps = {
  venue: Venue
  mode: WorkspaceMode
  onFieldChange: <K extends keyof Venue>(field: K, value: Venue[K]) => void
}

export function LocationSection({ venue, mode, onFieldChange }: LocationSectionProps) {
  return (
    <WorkspaceSection title="Location" icon={MapPin}>
      <dl className="grid grid-cols-2 gap-4">
        {mode === 'view' ? (
          <>
            <WorkspaceField label="Latitude" value={venue.latitude} />
            <WorkspaceField label="Longitude" value={venue.longitude} />
          </>
        ) : (
          <>
            <TextField
              label="Latitude"
              value={venue.latitude ?? ''}
              onChange={(v) => onFieldChange('latitude', v)}
            />
            <TextField
              label="Longitude"
              value={venue.longitude ?? ''}
              onChange={(v) => onFieldChange('longitude', v)}
            />
          </>
        )}
        <div className="col-span-2">
          {mode === 'view' ? (
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
          ) : (
            <TextField
              label="Maps Link"
              type="url"
              value={venue.maps_url ?? ''}
              onChange={(v) => onFieldChange('maps_url', v)}
            />
          )}
        </div>
      </dl>
    </WorkspaceSection>
  )
}
