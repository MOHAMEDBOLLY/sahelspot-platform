import { Info } from 'lucide-react'
import type { Event } from '../../../../types/event'
import { WorkspaceSection } from '../../../../components/workspace/WorkspaceSection'
import { WorkspaceField } from '../../../../components/workspace/WorkspaceField'
import { TextField } from '../../../../components/workspace/fields/TextField'
import { TextAreaField } from '../../../../components/workspace/fields/TextAreaField'
import { CheckboxField } from '../../../../components/workspace/fields/CheckboxField'
import { FieldLabel } from '../../../../components/workspace/fields/FieldLabel'
import { FIELD_INPUT_CLASSNAME } from '../../../../components/workspace/fields/fieldStyles'
import type { WorkspaceMode } from '../../../../components/workspace/types'
import { useVenues } from '../../../venues/useVenues'
import { useDestinations } from '../../../destinations/useDestinations'
import type { FieldErrors } from '../../../../lib/validation'

type EventBasicInfoSectionProps = {
  event: Event
  mode: WorkspaceMode
  onFieldChange: <K extends keyof Event>(field: K, value: Event[K]) => void
  errors?: FieldErrors
}

/** Events Module v1. `venue`/`destination` pickers set the *whole* ref
 * object (`{id, name}` or `null`), not a bare id — same pattern
 * `BasicInfoSection`'s `translations` field already uses for a nested-
 * object field via this same generic `onFieldChange<K extends keyof T>`
 * signature. Both are optional and independent: an event can have
 * either, both, or neither. */
export function EventBasicInfoSection({ event, mode, onFieldChange, errors = {} }: EventBasicInfoSectionProps) {
  const { data: venuesData } = useVenues({ pageSize: 100 }, { enabled: mode === 'edit' })
  const { data: destinationsData } = useDestinations({ pageSize: 100 })
  const venues = venuesData?.items ?? []
  const destinations = destinationsData?.items ?? []

  return (
    <WorkspaceSection title="Basic Information" icon={Info}>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {mode === 'view' ? (
          <WorkspaceField label="Title" value={event.title} />
        ) : (
          <TextField label="Title" value={event.title} onChange={(v) => onFieldChange('title', v)} error={errors.title} />
        )}

        <WorkspaceField label="Slug" value={event.slug} />

        {mode === 'view' ? (
          <WorkspaceField label="Start Date" value={event.start_date} />
        ) : (
          <FieldLabel label="Start Date">
            <input
              type="date"
              value={event.start_date}
              onChange={(e) => onFieldChange('start_date', e.target.value)}
              className={FIELD_INPUT_CLASSNAME}
            />
          </FieldLabel>
        )}

        {mode === 'view' ? (
          <WorkspaceField label="End Date" value={event.end_date} />
        ) : (
          <FieldLabel label="End Date">
            <input
              type="date"
              value={event.end_date ?? ''}
              onChange={(e) => onFieldChange('end_date', e.target.value || null)}
              className={FIELD_INPUT_CLASSNAME}
            />
          </FieldLabel>
        )}

        {mode === 'view' ? (
          <WorkspaceField label="Start Time" value={event.start_time} />
        ) : (
          <FieldLabel label="Start Time">
            <input
              type="time"
              value={event.start_time ?? ''}
              onChange={(e) => onFieldChange('start_time', e.target.value || null)}
              className={FIELD_INPUT_CLASSNAME}
            />
          </FieldLabel>
        )}

        {mode === 'view' ? (
          <WorkspaceField label="End Time" value={event.end_time} />
        ) : (
          <FieldLabel label="End Time">
            <input
              type="time"
              value={event.end_time ?? ''}
              onChange={(e) => onFieldChange('end_time', e.target.value || null)}
              className={FIELD_INPUT_CLASSNAME}
            />
          </FieldLabel>
        )}

        {mode === 'view' ? (
          <WorkspaceField label="Venue" value={event.venue?.name} />
        ) : (
          <FieldLabel label="Venue">
            <select
              value={event.venue?.id ?? ''}
              onChange={(e) => {
                const venue = venues.find((v) => v.id === e.target.value)
                onFieldChange('venue', venue ? { id: venue.id, name: venue.name } : null)
              }}
              className={FIELD_INPUT_CLASSNAME}
            >
              <option value="">No venue</option>
              {venues.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name}
                </option>
              ))}
            </select>
          </FieldLabel>
        )}

        {mode === 'view' ? (
          <WorkspaceField label="Destination" value={event.destination?.name} />
        ) : (
          <FieldLabel label="Destination">
            <select
              value={event.destination?.id ?? ''}
              onChange={(e) => {
                const destination = destinations.find((d) => d.id === e.target.value)
                onFieldChange('destination', destination ? { id: destination.id, name: destination.name } : null)
              }}
              className={FIELD_INPUT_CLASSNAME}
            >
              <option value="">No destination</option>
              {destinations.map((destination) => (
                <option key={destination.id} value={destination.id}>
                  {destination.name}
                </option>
              ))}
            </select>
          </FieldLabel>
        )}

        {mode === 'view' ? (
          <WorkspaceField label="Featured" value={event.featured ? 'Yes' : 'No'} />
        ) : (
          <CheckboxField label="Featured" checked={event.featured} onChange={(v) => onFieldChange('featured', v)} />
        )}
      </dl>

      <div className="mt-4">
        {mode === 'view' ? (
          <WorkspaceField label="Short Description" value={event.short_description} />
        ) : (
          <TextAreaField
            label="Short Description"
            value={event.short_description ?? ''}
            onChange={(v) => onFieldChange('short_description', v)}
            error={errors.short_description}
          />
        )}
      </div>
    </WorkspaceSection>
  )
}
