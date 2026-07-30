import type { MultiPolygon, Polygon } from 'geojson'
import type { Destination } from '../../types/destination'
import type { DestinationFeature, DestinationFeatureCollection } from '../../features/map/types/features'
import { MapLogger } from '../../features/map/MapLogger'

const VALID_BOUNDARY_TYPES = new Set(['Polygon', 'MultiPolygon'])

/** Mirrors the backend's own shape check (`_validate_boundary_shape`,
 * api/app/api/routes/destinations.py) rather than trusting `boundary`'s
 * loose `Record<string, unknown>` type — a destination whose boundary
 * doesn't pass this is treated the same as one with no boundary at all
 * (skipped, not rendered), never a runtime crash. */
function isPolygonGeometry(value: unknown): value is Polygon | MultiPolygon {
  if (!value || typeof value !== 'object') return false
  const geometry = value as { type?: unknown; coordinates?: unknown }
  return VALID_BOUNDARY_TYPES.has(geometry.type as string) && Array.isArray(geometry.coordinates)
}

function toDestinationFeature(destination: Destination): DestinationFeature | null {
  if (!destination.boundary) return null
  if (!isPolygonGeometry(destination.boundary)) {
    MapLogger.warn('Destination boundary failed shape validation, skipping', { destinationId: destination.id })
    return null
  }

  return {
    type: 'Feature',
    id: destination.id,
    geometry: destination.boundary,
    properties: {
      id: destination.id,
      name: destination.name,
      region: destination.region,
    },
  }
}

/** The single place `Destination[]` becomes GeoJSON — every consumer
 * (Boundary Layer, a future camera "center on destination") reads the
 * result of this function. Destinations without a real polygon are
 * omitted, not errored on — graceful degradation, not a broken layer. */
export function destinationsToFeatureCollection(destinations: Destination[]): DestinationFeatureCollection {
  const features: DestinationFeature[] = []
  for (const destination of destinations) {
    const feature = toDestinationFeature(destination)
    if (feature) features.push(feature)
  }
  return { type: 'FeatureCollection', features }
}
