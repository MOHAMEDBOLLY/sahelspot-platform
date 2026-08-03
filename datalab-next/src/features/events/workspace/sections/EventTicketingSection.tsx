import { Ticket } from 'lucide-react'
import type { Event } from '../../../../types/event'
import { WorkspaceSection } from '../../../../components/workspace/WorkspaceSection'
import { WorkspaceField } from '../../../../components/workspace/WorkspaceField'
import { TextField } from '../../../../components/workspace/fields/TextField'
import type { WorkspaceMode } from '../../../../components/workspace/types'

type EventTicketingSectionProps = {
  event: Event
  mode: WorkspaceMode
  onFieldChange: <K extends keyof Event>(field: K, value: Event[K]) => void
}

/** Ticketing — intentionally the simplest possible shape (task spec):
 * three plain fields, no provider table, no sync engine, no automation.
 * `ticket_provider` is free text (see `Event`'s backend docstring for
 * why), not a picker over a known set. */
export function EventTicketingSection({ event, mode, onFieldChange }: EventTicketingSectionProps) {
  return (
    <WorkspaceSection title="Ticketing" icon={Ticket}>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {mode === 'view' ? (
          <WorkspaceField label="Ticket Provider" value={event.ticket_provider} />
        ) : (
          <TextField
            label="Ticket Provider"
            value={event.ticket_provider ?? ''}
            onChange={(v) => onFieldChange('ticket_provider', v)}
          />
        )}

        {mode === 'view' ? (
          <WorkspaceField
            label="Ticket URL"
            value={
              event.ticket_url ? (
                <a href={event.ticket_url} target="_blank" rel="noreferrer" className="text-blue-700 underline">
                  {event.ticket_url}
                </a>
              ) : null
            }
          />
        ) : (
          <TextField
            label="Ticket URL"
            type="url"
            value={event.ticket_url ?? ''}
            onChange={(v) => onFieldChange('ticket_url', v)}
          />
        )}

        {mode === 'view' ? (
          <WorkspaceField label="External Event Id" value={event.external_event_id} />
        ) : (
          <TextField
            label="External Event Id"
            value={event.external_event_id ?? ''}
            onChange={(v) => onFieldChange('external_event_id', v)}
          />
        )}
      </dl>
    </WorkspaceSection>
  )
}
