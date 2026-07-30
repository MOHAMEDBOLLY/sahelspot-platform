import { CheckCircle2 } from 'lucide-react'
import { QUALITY_FIELD_LABELS, QUALITY_FIELD_SECTION_IDS, type QualityField } from '../lib/qualityFieldRegistry'
import type { VenueQuality } from '../lib/venueQuality'

type VenueMissingDataChipsProps = {
  quality: VenueQuality
  /** Defaults to scrolling the corresponding workspace section into
   * view. Override for reuse in a context with no in-page sections to
   * scroll to (e.g. a future Dashboard drill-down navigating elsewhere). */
  onFieldClick?: (field: QualityField) => void
}

function scrollToField(field: QualityField) {
  document.getElementById(QUALITY_FIELD_SECTION_IDS[field])?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/** One compact summary of everything missing on a venue — not repeated
 * per-field. Reads an already-computed `VenueQuality`; never evaluates
 * quality itself. Generic enough to be reused by a future QA Center or
 * Dashboard drill-down (see `onFieldClick`). */
export function VenueMissingDataChips({ quality, onFieldClick }: VenueMissingDataChipsProps) {
  if (quality.missingFields.length === 0) {
    return (
      <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
        <CheckCircle2 size={16} />
        Complete
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-medium text-gray-500">Missing:</span>
      {quality.missingFields.map((field) => {
        const label = QUALITY_FIELD_LABELS[field]
        return (
          <button
            key={field}
            type="button"
            onClick={() => (onFieldClick ? onFieldClick(field) : scrollToField(field))}
            aria-label={`Missing: ${label} — click to go to its section`}
            className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gray-900"
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
