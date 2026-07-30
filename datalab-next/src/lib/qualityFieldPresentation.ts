import { AtSign, Camera, Globe, Images, MapPin, Phone, type LucideIcon } from 'lucide-react'
import { QUALITY_FIELD_REGISTRY, type QualityField } from './qualityFieldRegistry'

/** Presentation layer for quality fields — icon only. Kept separate from
 * `qualityFieldRegistry.ts` so the domain registry (and anything that
 * consumes it, including `venueQuality.ts`) never has to import
 * `lucide-react`. `lucide-react` 1.24.0 has no Instagram/brand icons
 * (dropped for trademark reasons); `AtSign` is the generic stand-in
 * already used elsewhere in this codebase for Instagram (see the
 * Dashboard's pre-existing "With Instagram" stat tile). */
const QUALITY_FIELD_ICONS: Record<QualityField, LucideIcon> = {
  cover: Camera,
  gallery: Images,
  instagram: AtSign,
  website: Globe,
  phone: Phone,
  maps: MapPin,
}

export interface QualityFieldPresentation {
  id: QualityField
  label: string
  sectionId: string
  icon: LucideIcon
}

/** Same order as `QUALITY_FIELD_REGISTRY` — presentation never
 * re-declares field order, only adds the icon. */
export const QUALITY_FIELD_PRESENTATION: QualityFieldPresentation[] = QUALITY_FIELD_REGISTRY.map((field) => ({
  ...field,
  icon: QUALITY_FIELD_ICONS[field.id],
}))

export function getQualityFieldIcon(id: QualityField): LucideIcon {
  return QUALITY_FIELD_ICONS[id]
}
