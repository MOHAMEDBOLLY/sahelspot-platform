import { Info } from 'lucide-react'
import type { Destination } from '../../../../types/destination'
import { WorkspaceSection } from '../../../../components/workspace/WorkspaceSection'
import { WorkspaceField } from '../../../../components/workspace/WorkspaceField'
import { TextField } from '../../../../components/workspace/fields/TextField'
import { TextAreaField } from '../../../../components/workspace/fields/TextAreaField'
import type { WorkspaceMode } from '../../../../components/workspace/types'
import type { FieldErrors } from '../../../../lib/validation'

type BasicInfoSectionProps = {
  destination: Destination
  mode: WorkspaceMode
  onFieldChange: <K extends keyof Destination>(field: K, value: Destination[K]) => void
  errors?: FieldErrors
}

/** Aliases round-trip through a single comma-separated text field in Edit
 * Mode — a real array editor (add/remove one at a time) wasn't worth
 * building for a handful of alternate names; this is the same "simplest
 * control that handles the data" call the Venue Workspace already made
 * for e.g. gallery URLs staying read-only. */
function aliasesToText(aliases: string[] | null): string {
  return aliases?.join(', ') ?? ''
}

function textToAliases(value: string): string[] | null {
  const aliases = value
    .split(',')
    .map((alias) => alias.trim())
    .filter(Boolean)
  return aliases.length > 0 ? aliases : null
}

export function BasicInfoSection({ destination, mode, onFieldChange, errors = {} }: BasicInfoSectionProps) {
  return (
    <WorkspaceSection title="Basic Information" icon={Info}>
      <dl className="grid grid-cols-2 gap-4">
        {mode === 'view' ? (
          <WorkspaceField label="Name" value={destination.name} />
        ) : (
          <TextField
            label="Name"
            value={destination.name}
            onChange={(v) => onFieldChange('name', v)}
            error={errors.name}
          />
        )}

        {mode === 'view' ? (
          <WorkspaceField label="Region" value={destination.region} />
        ) : (
          <TextField
            label="Region"
            value={destination.region}
            onChange={(v) => onFieldChange('region', v)}
            error={errors.region}
          />
        )}

        <div className="col-span-2">
          {mode === 'view' ? (
            <WorkspaceField label="Aliases" value={destination.aliases?.join(', ')} />
          ) : (
            <TextField
              label="Aliases (comma-separated)"
              value={aliasesToText(destination.aliases)}
              onChange={(v) => onFieldChange('aliases', textToAliases(v))}
            />
          )}
        </div>
      </dl>
      <div className="mt-4">
        {mode === 'view' ? (
          <WorkspaceField label="Notes" value={destination.notes} />
        ) : (
          <TextAreaField
            label="Notes"
            value={destination.notes ?? ''}
            onChange={(v) => onFieldChange('notes', v)}
            error={errors.notes}
          />
        )}
      </div>
    </WorkspaceSection>
  )
}
