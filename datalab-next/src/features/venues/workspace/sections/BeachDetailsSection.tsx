import { Waves } from 'lucide-react'
import type { Venue } from '../../../../types/venue'
import { WorkspaceSection } from '../../../../components/workspace/WorkspaceSection'
import { WorkspaceField } from '../../../../components/workspace/WorkspaceField'
import { TextField } from '../../../../components/workspace/fields/TextField'
import { SelectField } from '../../../../components/workspace/fields/SelectField'
import type { WorkspaceMode } from '../../../../components/workspace/types'

const BEACH_PUBLIC_ACCESS_VALUES = ['yes', 'no', 'unknown'] as const

type BeachDetailsSectionProps = {
  venue: Venue
  mode: WorkspaceMode
  onFieldChange: <K extends keyof Venue>(field: K, value: Venue[K]) => void
}

/** EP19-T02 — only rendered for `category === 'Beach'` (see
 * `VenueWorkspace`), so there's no way to submit `beach_details` for a
 * non-Beach venue from the UI — the backend's own gate
 * (`validate_beach_details_shape`, api/app/validation/venues.py) is the
 * canonical check, this only avoids the always-invalid round trip.
 */
export function BeachDetailsSection({ venue, mode, onFieldChange }: BeachDetailsSectionProps) {
  const beachDetails = (venue.beach_details ?? {}) as { type?: string; publicAccess?: string }

  function updateBeachDetails(field: 'type' | 'publicAccess', value: string) {
    onFieldChange('beach_details', { ...beachDetails, [field]: value })
  }

  return (
    <WorkspaceSection title="Beach Details" icon={Waves}>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {mode === 'view' ? (
          <>
            <WorkspaceField label="Type" value={beachDetails.type ?? null} />
            <WorkspaceField label="Public Access" value={beachDetails.publicAccess ?? null} />
          </>
        ) : (
          <>
            <TextField label="Type" value={beachDetails.type ?? ''} onChange={(v) => updateBeachDetails('type', v)} />
            <SelectField
              label="Public Access"
              value={beachDetails.publicAccess ?? BEACH_PUBLIC_ACCESS_VALUES[2]}
              onChange={(v) => updateBeachDetails('publicAccess', v)}
              options={BEACH_PUBLIC_ACCESS_VALUES}
            />
          </>
        )}
      </dl>
    </WorkspaceSection>
  )
}
