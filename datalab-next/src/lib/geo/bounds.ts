import type { Feature, FeatureCollection, Geometry, Position } from 'geojson'
import type { Bounds } from '../../features/map/providers/mapProvider'

/** Recursively walks any GeoJSON coordinate array (Point/Polygon/
 * MultiPolygon all nest `Position` differently) and extends `bounds` in
 * place — one function handles every geometry type this feature uses
 * rather than a branch per type. */
function extendBoundsWithCoordinates(bounds: Bounds, coordinates: unknown): void {
  const values = coordinates as unknown[]
  if (typeof values[0] === 'number') {
    const [lng, lat] = values as Position
    if (lng < bounds[0]) bounds[0] = lng
    if (lat < bounds[1]) bounds[1] = lat
    if (lng > bounds[2]) bounds[2] = lng
    if (lat > bounds[3]) bounds[3] = lat
    return
  }
  for (const child of values) {
    extendBoundsWithCoordinates(bounds, child)
  }
}

function emptyBounds(): Bounds {
  return [Infinity, Infinity, -Infinity, -Infinity]
}

function isFiniteBounds(bounds: Bounds): boolean {
  return bounds.every((value) => Number.isFinite(value))
}

/** Bounding box of a single geometry — used by "center on destination"
 * (a single boundary polygon) without needing a whole FeatureCollection. */
export function boundsOfGeometry(geometry: Geometry): Bounds | null {
  if (!('coordinates' in geometry)) return null
  const bounds = emptyBounds()
  extendBoundsWithCoordinates(bounds, geometry.coordinates)
  return isFiniteBounds(bounds) ? bounds : null
}

/** Bounding box of every feature in a collection — used to fit the map
 * to "all venues" or "all destination boundaries." Returns `null` for an
 * empty collection rather than an infinite/degenerate box. */
export function boundsOfFeatureCollection(collection: FeatureCollection): Bounds | null {
  const bounds = emptyBounds()
  for (const feature of collection.features as Feature[]) {
    if (feature.geometry && 'coordinates' in feature.geometry) {
      extendBoundsWithCoordinates(bounds, feature.geometry.coordinates)
    }
  }
  return isFiniteBounds(bounds) ? bounds : null
}
