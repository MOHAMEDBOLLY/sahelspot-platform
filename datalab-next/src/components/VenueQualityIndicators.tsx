import { TRACKED_QUALITY_FIELDS, QUALITY_FIELD_LABELS } from '../lib/qualityFieldRegistry'
import type { VenueQuality } from '../lib/venueQuality'

type VenueQualityIndicatorsProps = {
  quality: VenueQuality
  className?: string
}

const PRESENCE_KEY = {
  cover: 'hasCover',
  gallery: 'hasGallery',
  instagram: 'hasInstagram',
  website: 'hasWebsite',
  phone: 'hasPhone',
  maps: 'hasMaps',
} as const

/** Pure renderer of an already-computed `VenueQuality` result — no
 * evaluation happens here, so it's safe to use anywhere a `VenueQuality`
 * is available (list, editor, dashboard) without re-deriving anything. */
export function VenueQualityIndicators({ quality, className = '' }: VenueQualityIndicatorsProps) {
  return (
    <div className={['flex items-center gap-1.5', className].join(' ')}>
      <span
        className="text-[11px] font-medium tabular-nums text-gray-500"
        title={`${quality.completionPercent}% complete (${quality.score}/${TRACKED_QUALITY_FIELDS.length} fields)`}
      >
        {quality.completionPercent}%
      </span>
      <div className="flex items-center gap-0.5">
        {TRACKED_QUALITY_FIELDS.map((field) => {
          const present = quality[PRESENCE_KEY[field]]
          const label = QUALITY_FIELD_LABELS[field]
          return (
            <span
              key={field}
              title={`${label}: ${present ? 'Present' : 'Missing'}`}
              aria-label={`${label}: ${present ? 'Present' : 'Missing'}`}
              className={[
                'h-1.5 w-1.5 rounded-full',
                present ? 'bg-emerald-500' : 'bg-gray-200',
              ].join(' ')}
            />
          )
        })}
      </div>
    </div>
  )
}
