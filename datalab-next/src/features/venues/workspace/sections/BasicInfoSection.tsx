import { Info } from 'lucide-react'
import type { Venue } from '../../../../types/venue'
import { WorkspaceSection } from '../WorkspaceSection'
import { WorkspaceField } from '../WorkspaceField'
import { TextField } from '../fields/TextField'
import { TextAreaField } from '../fields/TextAreaField'
import { SelectField } from '../fields/SelectField'
import { CheckboxField } from '../fields/CheckboxField'
import type { WorkspaceMode } from '../types'
import { VENUE_CATEGORIES } from '../../venueCategories'

type BasicInfoSectionProps = {
  venue: Venue
  mode: WorkspaceMode
  onFieldChange: <K extends keyof Venue>(field: K, value: Venue[K]) => void
}

export function BasicInfoSection({ venue, mode, onFieldChange }: BasicInfoSectionProps) {
  return (
    <WorkspaceSection title="Basic Information" icon={Info}>
      <dl className="grid grid-cols-2 gap-4">
        {mode === 'view' ? (
          <WorkspaceField label="Name" value={venue.name} />
        ) : (
          <TextField label="Name" value={venue.name} onChange={(v) => onFieldChange('name', v)} />
        )}

        {/* Slug is a structural/URL identity, not a generic text field — left read-only until
            editing gets real validation (uniqueness, redirect handling). */}
        <WorkspaceField label="Slug" value={venue.slug} />

        {mode === 'view' ? (
          <WorkspaceField label="Category" value={venue.category} />
        ) : (
          <SelectField
            label="Category"
            value={venue.category}
            onChange={(v) => onFieldChange('category', v)}
            options={VENUE_CATEGORIES}
          />
        )}

        {/* Destination requires picking from the real destination list, which means an API
            call — out of scope for this sprint (no API calls). Read-only for now. */}
        <WorkspaceField label="Destination" value={venue.destination.name} />

        {mode === 'view' ? (
          <WorkspaceField label="District" value={venue.district} />
        ) : (
          <TextField
            label="District"
            value={venue.district ?? ''}
            onChange={(v) => onFieldChange('district', v)}
          />
        )}

        {mode === 'view' ? (
          <>
            <WorkspaceField label="Featured" value={venue.is_featured ? 'Yes' : 'No'} />
            <WorkspaceField label="Verified" value={venue.is_verified ? 'Yes' : 'No'} />
          </>
        ) : (
          <>
            <CheckboxField
              label="Featured"
              checked={venue.is_featured}
              onChange={(v) => onFieldChange('is_featured', v)}
            />
            <CheckboxField
              label="Verified"
              checked={venue.is_verified}
              onChange={(v) => onFieldChange('is_verified', v)}
            />
          </>
        )}
      </dl>
      <div className="mt-4">
        {mode === 'view' ? (
          <WorkspaceField label="Short Description" value={venue.short_description} />
        ) : (
          <TextAreaField
            label="Short Description"
            value={venue.short_description ?? ''}
            onChange={(v) => onFieldChange('short_description', v)}
          />
        )}
      </div>
    </WorkspaceSection>
  )
}
