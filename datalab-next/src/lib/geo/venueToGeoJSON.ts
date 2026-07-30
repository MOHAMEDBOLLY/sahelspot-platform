import type { Venue } from '../../types/venue'
import type { VenueFeature, VenueFeatureCollection } from '../../features/map/types/features'

/** Venues with no/invalid coordinates simply can't be plotted — filtered
 * out here rather than producing a broken Point geometry the layer would
 * have to guard against. */
function toVenueFeature(venue: Venue): VenueFeature | null {
  if (!venue.latitude || !venue.longitude) return null
  const lat = Number(venue.latitude)
  const lng = Number(venue.longitude)
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null

  return {
    type: 'Feature',
    id: venue.id,
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: {
      id: venue.id,
      name: venue.name,
      category: venue.category,
      destinationId: venue.destination.id,
      destinationName: venue.destination.name,
      status: venue.status,
      isVerified: venue.is_verified,
      coverImageUrl: venue.cover_image_url,
    },
  }
}

/** The single place `Venue[]` becomes GeoJSON — every consumer (Venue
 * Layer, Cluster Layer, a future popup) reads the result of this
 * function, never re-derives its own Point geometry from a venue. */
export function venuesToFeatureCollection(venues: Venue[]): VenueFeatureCollection {
  const features: VenueFeature[] = []
  for (const venue of venues) {
    const feature = toVenueFeature(venue)
    if (feature) features.push(feature)
  }
  return { type: 'FeatureCollection', features }
}
