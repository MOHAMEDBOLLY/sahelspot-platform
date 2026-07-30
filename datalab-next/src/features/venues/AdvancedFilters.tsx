import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { QUALITY_FIELD_PRESENTATION } from '../../lib/qualityFieldPresentation'
import type { QualityFilterParams } from '../../lib/venueQualityFilter'
import type { QualityField } from '../../lib/qualityFieldRegistry'

type AdvancedFiltersProps = {
  params: QualityFilterParams
  onChange: (next: QualityFilterParams) => void
}

const CHECKBOX_CLASSNAME = 'h-3.5 w-3.5 rounded border-gray-300'
const NUMBER_INPUT_CLASSNAME =
  'min-h-11 w-16 rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-gray-900 focus:outline-none lg:min-h-0'

function toggleField(list: QualityField[] | undefined, field: QualityField): QualityField[] | undefined {
  const current = list ?? []
  const next = current.includes(field) ? current.filter((f) => f !== field) : [...current, field]
  return next.length > 0 ? next : undefined
}

/**
 * Extends (doesn't replace) the existing filter system — this renders
 * alongside `VenueFilters`, one more controlled panel driven by the same
 * URL-owned state pattern `pages/Venues.tsx` already uses. Every control
 * here reads/writes a `QualityFilterParams` object; "presets" (Nearly
 * Complete, Complete Only, Has/No Digital Presence) are just convenience
 * buttons that set particular values of the same five primitives the
 * checkboxes/inputs below already expose — no separate preset predicate
 * exists anywhere.
 */
export function AdvancedFilters({ params, onChange }: AdvancedFiltersProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        className="flex min-h-11 w-full items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 lg:min-h-0"
      >
        Advanced Filters
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <div className="flex flex-col gap-4 border-t border-gray-100 p-3">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => onChange({ ...params, missingCount: 1 })}
              className="min-h-11 rounded-full border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 lg:min-h-0"
            >
              Nearly Complete
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...params, minCompletion: 100, maxCompletion: undefined })}
              className="min-h-11 rounded-full border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 lg:min-h-0"
            >
              Complete Only
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...params, maxCompletion: 100, minCompletion: undefined })}
              className="min-h-11 rounded-full border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 lg:min-h-0"
            >
              Needs Attention
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...params, digitalPresence: 'any' })}
              className="min-h-11 rounded-full border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 lg:min-h-0"
            >
              Has Digital Presence
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...params, digitalPresence: 'none' })}
              className="min-h-11 rounded-full border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 lg:min-h-0"
            >
              No Digital Presence
            </button>
          </div>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-xs font-medium uppercase tracking-wide text-gray-500">Has</legend>
            <div className="grid grid-cols-2 gap-1.5">
              {QUALITY_FIELD_PRESENTATION.map(({ id, label }) => (
                <label key={id} className="flex min-h-11 items-center gap-1.5 text-sm text-gray-700 lg:min-h-0">
                  <input
                    type="checkbox"
                    className={CHECKBOX_CLASSNAME}
                    checked={params.has?.includes(id) ?? false}
                    onChange={() => onChange({ ...params, has: toggleField(params.has, id) })}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-xs font-medium uppercase tracking-wide text-gray-500">Missing</legend>
            <div className="grid grid-cols-2 gap-1.5">
              {QUALITY_FIELD_PRESENTATION.map(({ id, label }) => (
                <label key={id} className="flex min-h-11 items-center gap-1.5 text-sm text-gray-700 lg:min-h-0">
                  <input
                    type="checkbox"
                    className={CHECKBOX_CLASSNAME}
                    checked={params.missing?.includes(id) ?? false}
                    onChange={() => onChange({ ...params, missing: toggleField(params.missing, id) })}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-xs font-medium uppercase tracking-wide text-gray-500">Completion %</legend>
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <label className="flex items-center gap-1.5">
                Min
                <input
                  type="number"
                  min={0}
                  max={100}
                  className={NUMBER_INPUT_CLASSNAME}
                  value={params.minCompletion ?? ''}
                  onChange={(event) =>
                    onChange({
                      ...params,
                      minCompletion: event.target.value === '' ? undefined : Number(event.target.value),
                    })
                  }
                />
              </label>
              <label className="flex items-center gap-1.5">
                Max
                <input
                  type="number"
                  min={0}
                  max={100}
                  className={NUMBER_INPUT_CLASSNAME}
                  value={params.maxCompletion ?? ''}
                  onChange={(event) =>
                    onChange({
                      ...params,
                      maxCompletion: event.target.value === '' ? undefined : Number(event.target.value),
                    })
                  }
                />
              </label>
            </div>
          </fieldset>
        </div>
      )}
    </div>
  )
}
