import { Clock } from 'lucide-react'
import type { Venue } from '../../../../types/venue'
import { WorkspaceSection } from '../WorkspaceSection'

type OpeningHoursSectionProps = {
  venue: Venue
}

const DAYS: { key: keyof NonNullable<Venue['opening_hours']>; label: string }[] = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
]

export function OpeningHoursSection({ venue }: OpeningHoursSectionProps) {
  const hours = venue.opening_hours

  if (!hours) {
    return (
      <WorkspaceSection title="Opening Hours" icon={Clock}>
        <p className="text-sm text-gray-400 italic">Not set</p>
      </WorkspaceSection>
    )
  }

  return (
    <WorkspaceSection title="Opening Hours" icon={Clock}>
      <ul className="divide-y divide-gray-100">
        {DAYS.map(({ key, label }) => {
          const ranges = hours[key]
          return (
            <li key={key} className="flex items-center justify-between py-2 text-sm">
              <span className="text-gray-600">{label}</span>
              <span className="font-medium text-gray-900">
                {ranges && ranges.length > 0
                  ? ranges.map((range) => range.join(' – ')).join(', ')
                  : 'Closed'}
              </span>
            </li>
          )
        })}
      </ul>
    </WorkspaceSection>
  )
}
