import type { Event } from '../../types/event'
import { StatusBadge } from '../../components/StatusBadge'

type EventListProps = {
  events: Event[]
  selectedEventId: string | null
  onSelectEvent: (id: string) => void
  checkedEventIds: ReadonlySet<string>
  onToggleChecked: (id: string) => void
}

const PHASE_STYLES: Record<string, string> = {
  upcoming: 'bg-blue-50 text-blue-700',
  live: 'bg-emerald-50 text-emerald-700',
  ended: 'bg-gray-100 text-gray-500',
}

export function EventList({
  events,
  selectedEventId,
  onSelectEvent,
  checkedEventIds,
  onToggleChecked,
}: EventListProps) {
  return (
    <ul className="flex shrink-0 flex-col divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
      {events.map((event) => {
        const isSelected = event.id === selectedEventId
        const isChecked = checkedEventIds.has(event.id)
        return (
          <li key={event.id} className="flex items-stretch">
            <label
              className="flex min-w-11 shrink-0 items-center justify-center pl-3 lg:min-w-0 lg:justify-start"
              onClick={(clickEvent) => clickEvent.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => onToggleChecked(event.id)}
                aria-label={`Select ${event.title}`}
                className="h-4 w-4 rounded border-gray-300"
              />
            </label>
            <button
              type="button"
              onClick={() => onSelectEvent(event.id)}
              aria-current={isSelected ? 'true' : undefined}
              className={[
                'flex w-full flex-col gap-1.5 px-3 py-3 text-left transition-colors',
                isSelected ? 'bg-gray-900' : 'hover:bg-gray-50',
              ].join(' ')}
            >
              <span
                className={['truncate text-sm font-medium', isSelected ? 'text-white' : 'text-gray-900'].join(' ')}
              >
                {event.title}
                {event.featured && ' ★'}
              </span>
              <span className={['truncate text-xs', isSelected ? 'text-gray-300' : 'text-gray-500'].join(' ')}>
                {event.start_date}
                {event.venue ? ` · ${event.venue.name}` : event.destination ? ` · ${event.destination.name}` : ''}
              </span>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <StatusBadge status={event.status} />
                {event.phase && (
                  <span
                    className={[
                      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
                      PHASE_STYLES[event.phase] ?? 'bg-gray-100 text-gray-700',
                    ].join(' ')}
                  >
                    {event.phase}
                  </span>
                )}
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
