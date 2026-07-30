/** Single source of truth for which fields count toward venue data
 * quality, their display order, their label, and which workspace section
 * they belong to. Deliberately UI-independent — no icon components, no
 * React, no `lucide-react` import — so `venueQuality.ts` (the domain
 * evaluator) can consume this without gaining a presentation-layer
 * dependency. Icon mapping lives separately in
 * `qualityFieldPresentation.ts`.
 *
 * Order here is the canonical display/iteration order used everywhere
 * (list indicators, missing-data chips, dashboard strip) — defined once,
 * not re-declared per consumer. */
export type QualityField = 'cover' | 'gallery' | 'instagram' | 'website' | 'phone' | 'maps'

export interface QualityFieldDefinition {
  id: QualityField
  label: string
  /** DOM id of the venue workspace section this field's editor lives in
   * — used to scroll a missing-data chip into view. */
  sectionId: string
}

export const QUALITY_FIELD_REGISTRY: QualityFieldDefinition[] = [
  { id: 'cover', label: 'Cover', sectionId: 'venue-section-images' },
  { id: 'gallery', label: 'Gallery', sectionId: 'venue-section-images' },
  { id: 'instagram', label: 'Instagram', sectionId: 'venue-section-contact' },
  { id: 'website', label: 'Website', sectionId: 'venue-section-contact' },
  { id: 'phone', label: 'Phone', sectionId: 'venue-section-contact' },
  { id: 'maps', label: 'Maps', sectionId: 'venue-section-location' },
]

export const TRACKED_QUALITY_FIELDS: readonly QualityField[] = QUALITY_FIELD_REGISTRY.map((f) => f.id)

export const QUALITY_FIELD_LABELS: Record<QualityField, string> = Object.fromEntries(
  QUALITY_FIELD_REGISTRY.map((f) => [f.id, f.label]),
) as Record<QualityField, string>

export const QUALITY_FIELD_SECTION_IDS: Record<QualityField, string> = Object.fromEntries(
  QUALITY_FIELD_REGISTRY.map((f) => [f.id, f.sectionId]),
) as Record<QualityField, string>

export function getQualityFieldDefinition(id: QualityField): QualityFieldDefinition {
  const definition = QUALITY_FIELD_REGISTRY.find((f) => f.id === id)
  if (!definition) throw new Error(`No quality field definition for "${id}"`)
  return definition
}
