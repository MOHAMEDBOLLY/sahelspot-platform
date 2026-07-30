import type { Venue } from '../types/venue'
import { TRACKED_QUALITY_FIELDS, type QualityField } from './qualityFieldRegistry'

export type { QualityField } from './qualityFieldRegistry'
export { TRACKED_QUALITY_FIELDS } from './qualityFieldRegistry'

export interface VenueQuality {
  /** 0-100, rounded (see rounding note below). */
  completionPercent: number
  /** Raw count of present fields, 0-6. Kept distinct from
   * `completionPercent` so a future weighting system can change what
   * `score` means without altering the percent formula. */
  score: number
  hasCover: boolean
  hasGallery: boolean
  hasInstagram: boolean
  hasWebsite: boolean
  hasPhone: boolean
  hasMaps: boolean
  /** Field keys, in `TRACKED_QUALITY_FIELDS` order. */
  missingFields: QualityField[]
  completedFields: QualityField[]
}

function isPresent(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function hasGalleryImages(value: string[] | null | undefined): boolean {
  return Array.isArray(value) && value.length > 0
}

/**
 * Single source of truth for venue data-quality evaluation. Pure, UI-free,
 * safe to call from React, a future API endpoint, or a script — no browser
 * or React API used. Tracked fields, their order, and their labels come
 * from `qualityFieldRegistry.ts` (also UI-independent); this module adds
 * no field metadata of its own.
 *
 * Formula: 6 tracked fields (see `TRACKED_QUALITY_FIELDS`), each
 * contributing equally (1/6) — no weighting, since none is specified as
 * official. "Present" means non-null/non-empty-after-trim (or non-empty
 * array for gallery); this evaluates *presence*, not format validity.
 *
 * completionPercent = Math.round((completedFields.length / 6) * 100)
 * — standard rounding, e.g. 1/6 -> 17%, 5/6 -> 83%.
 */
export function evaluateVenueQuality(venue: Venue): VenueQuality {
  const hasCover = isPresent(venue.cover_image_url)
  const hasGallery = hasGalleryImages(venue.gallery_image_urls)
  const hasInstagram = isPresent(venue.instagram_handle)
  const hasWebsite = isPresent(venue.website)
  const hasPhone = isPresent(venue.phone)
  const hasMaps = isPresent(venue.maps_url)

  const presence: Record<QualityField, boolean> = {
    cover: hasCover,
    gallery: hasGallery,
    instagram: hasInstagram,
    website: hasWebsite,
    phone: hasPhone,
    maps: hasMaps,
  }

  const completedFields = TRACKED_QUALITY_FIELDS.filter((field) => presence[field])
  const missingFields = TRACKED_QUALITY_FIELDS.filter((field) => !presence[field])
  const score = completedFields.length
  const completionPercent = Math.round((score / TRACKED_QUALITY_FIELDS.length) * 100)

  return {
    completionPercent,
    score,
    hasCover,
    hasGallery,
    hasInstagram,
    hasWebsite,
    hasPhone,
    hasMaps,
    missingFields,
    completedFields,
  }
}
