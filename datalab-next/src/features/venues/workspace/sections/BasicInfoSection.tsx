import { Info } from 'lucide-react'
import type { Venue } from '../../../../types/venue'
import { WorkspaceSection } from '../../../../components/workspace/WorkspaceSection'
import { WorkspaceField } from '../../../../components/workspace/WorkspaceField'
import { TextField } from '../../../../components/workspace/fields/TextField'
import { TextAreaField } from '../../../../components/workspace/fields/TextAreaField'
import { SelectField } from '../../../../components/workspace/fields/SelectField'
import { CheckboxField } from '../../../../components/workspace/fields/CheckboxField'
import type { WorkspaceMode } from '../../../../components/workspace/types'
import { ACCESS_TYPES, RESERVATION_POLICIES, VENUE_CATEGORIES } from '../../venueCategories'
import type { FieldErrors } from '../../../../lib/validation'

type BasicInfoSectionProps = {
  venue: Venue
  mode: WorkspaceMode
  onFieldChange: <K extends keyof Venue>(field: K, value: Venue[K]) => void
  errors?: FieldErrors
}

export function BasicInfoSection({ venue, mode, onFieldChange, errors = {} }: BasicInfoSectionProps) {
  return (
    <WorkspaceSection title="Basic Information" icon={Info}>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {mode === 'view' ? (
          <WorkspaceField label="Name" value={venue.name} />
        ) : (
          <TextField
            label="Name"
            value={venue.name}
            onChange={(v) => onFieldChange('name', v)}
            error={errors.name}
          />
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

        {/* Category/Tags/Access Type/Badges/Collections architecture
            (Phase 1) — independent of category (see `Venue.access_type`'s
            own docstring, api/app/db/models.py), so it lives here in Basic
            Information alongside Category, not in a category-conditional
            section the way BeachDetailsSection is. The leading '' option
            maps to `null` ("not yet classified") — not the same as any of
            the 5 real values. */}
        {mode === 'view' ? (
          <WorkspaceField label="Access Type" value={venue.access_type} />
        ) : (
          <SelectField
            label="Access Type"
            value={venue.access_type ?? ''}
            onChange={(v) => onFieldChange('access_type', v === '' ? null : v)}
            options={['', ...ACCESS_TYPES]}
          />
        )}

        {/* Badges, not a filter (see the architecture doc) — still a plain
            venue-level field, same reasoning as Access Type above. */}
        {mode === 'view' ? (
          <WorkspaceField label="Reservation Policy" value={venue.reservation_policy} />
        ) : (
          <SelectField
            label="Reservation Policy"
            value={venue.reservation_policy ?? ''}
            onChange={(v) => onFieldChange('reservation_policy', v === '' ? null : v)}
            options={['', ...RESERVATION_POLICIES]}
          />
        )}

        {mode === 'view' ? (
          <WorkspaceField label="Arabic Name" value={venue.translations?.ar?.name ?? null} />
        ) : (
          <TextField
            label="Arabic Name"
            value={venue.translations?.ar?.name ?? ''}
            onChange={(v) =>
              onFieldChange('translations', { ...venue.translations, ar: { ...venue.translations?.ar, name: v } })
            }
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

        {/* Brand Asset Propagation — free text, never inferred from Name.
            Two venues share a brand purely by this value matching exactly. */}
        {mode === 'view' ? (
          <WorkspaceField label="Brand" value={venue.brand} />
        ) : (
          <TextField
            label="Brand"
            value={venue.brand ?? ''}
            onChange={(v) => onFieldChange('brand', v)}
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
            error={errors.short_description}
          />
        )}
      </div>
    </WorkspaceSection>
  )
}
