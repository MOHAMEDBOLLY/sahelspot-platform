import { X } from 'lucide-react'
import { useDestinations } from '../destinations/useDestinations'
import { QUALITY_FIELD_LABELS } from '../../lib/qualityFieldRegistry'
import type { QualityFilterParams } from '../../lib/venueQualityFilter'

type Chip = { key: string; label: string; onRemove: () => void }

type ActiveFilterChipsProps = {
  q: string
  onClearQ: () => void
  destinationId: string
  onClearDestination: () => void
  category: string
  onClearCategory: () => void
  status: string
  onClearStatus: () => void
  qualityFilter: QualityFilterParams
  onQualityFilterChange: (next: QualityFilterParams) => void
  onClearAll: () => void
}

/** One removable chip per active filter dimension, across both the
 * original 4 filters and every Advanced Filters primitive — reads the
 * same state `pages/Venues.tsx` owns, never a second copy of it. Renders
 * nothing when no filter is active. */
export function ActiveFilterChips({
  q,
  onClearQ,
  destinationId,
  onClearDestination,
  category,
  onClearCategory,
  status,
  onClearStatus,
  qualityFilter,
  onQualityFilterChange,
  onClearAll,
}: ActiveFilterChipsProps) {
  const { data: destinationsData } = useDestinations()
  const destinationName = destinationsData?.items.find((d) => d.id === destinationId)?.name ?? destinationId

  const chips: Chip[] = []

  if (q) chips.push({ key: 'q', label: `"${q}"`, onRemove: onClearQ })
  if (destinationId) chips.push({ key: 'destination', label: destinationName, onRemove: onClearDestination })
  if (category) chips.push({ key: 'category', label: category, onRemove: onClearCategory })
  if (status) chips.push({ key: 'status', label: status, onRemove: onClearStatus })

  for (const field of qualityFilter.has ?? []) {
    chips.push({
      key: `has-${field}`,
      label: `Has ${QUALITY_FIELD_LABELS[field]}`,
      onRemove: () =>
        onQualityFilterChange({
          ...qualityFilter,
          has: qualityFilter.has!.filter((f) => f !== field).length
            ? qualityFilter.has!.filter((f) => f !== field)
            : undefined,
        }),
    })
  }
  for (const field of qualityFilter.missing ?? []) {
    chips.push({
      key: `missing-${field}`,
      label: `Missing ${QUALITY_FIELD_LABELS[field]}`,
      onRemove: () =>
        onQualityFilterChange({
          ...qualityFilter,
          missing: qualityFilter.missing!.filter((f) => f !== field).length
            ? qualityFilter.missing!.filter((f) => f !== field)
            : undefined,
        }),
    })
  }
  if (qualityFilter.minCompletion !== undefined) {
    chips.push({
      key: 'minCompletion',
      label: `Completion ≥ ${qualityFilter.minCompletion}%`,
      onRemove: () => onQualityFilterChange({ ...qualityFilter, minCompletion: undefined }),
    })
  }
  if (qualityFilter.maxCompletion !== undefined) {
    chips.push({
      key: 'maxCompletion',
      label: `Completion < ${qualityFilter.maxCompletion}%`,
      onRemove: () => onQualityFilterChange({ ...qualityFilter, maxCompletion: undefined }),
    })
  }
  if (qualityFilter.missingCount !== undefined) {
    chips.push({
      key: 'missingCount',
      label: `Missing exactly ${qualityFilter.missingCount} field${qualityFilter.missingCount === 1 ? '' : 's'}`,
      onRemove: () => onQualityFilterChange({ ...qualityFilter, missingCount: undefined }),
    })
  }
  if (qualityFilter.digitalPresence) {
    chips.push({
      key: 'digitalPresence',
      label: qualityFilter.digitalPresence === 'any' ? 'Has Digital Presence' : 'No Digital Presence',
      onRemove: () => onQualityFilterChange({ ...qualityFilter, digitalPresence: undefined }),
    })
  }

  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="flex items-center gap-1 rounded-full border border-gray-300 bg-gray-50 py-1 pl-2.5 pr-1 text-xs font-medium text-gray-700"
        >
          {chip.label}
          <button
            type="button"
            onClick={chip.onRemove}
            aria-label={`Remove filter: ${chip.label}`}
            className="relative flex h-4 w-4 items-center justify-center rounded-full hover:bg-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gray-900 max-lg:after:absolute max-lg:after:inset-[-14px] max-lg:after:content-['']"
          >
            <X size={10} />
          </button>
        </span>
      ))}
      {chips.length > 1 && (
        <button
          type="button"
          onClick={onClearAll}
          className="min-h-11 rounded-full px-2 py-1 text-xs font-medium text-gray-500 underline hover:text-gray-900 lg:min-h-0"
        >
          Clear all
        </button>
      )}
    </div>
  )
}
