import type { Feature, FeatureCollection, MultiPolygon, Point, Polygon } from 'geojson'

/** Properties carried by every venue point feature — exactly what the
 * Venue Layer, Cluster Layer, and (in a later phase) the popup need, no
 * more. Sourced from `features/map/geo/venueToGeoJSON.ts`, never
 * constructed ad hoc elsewhere. */
export interface VenueFeatureProperties {
  id: string
  name: string
  category: string
  destinationId: string
  destinationName: string
  status: string
  isVerified: boolean
  coverImageUrl: string | null
  [key: string]: unknown
}

export type VenueFeature = Feature<Point, VenueFeatureProperties>
export type VenueFeatureCollection = FeatureCollection<Point, VenueFeatureProperties>

/** Properties carried by every destination boundary polygon feature. */
export interface DestinationFeatureProperties {
  id: string
  name: string
  region: string
  [key: string]: unknown
}

export type DestinationFeature = Feature<Polygon | MultiPolygon, DestinationFeatureProperties>
export type DestinationFeatureCollection = FeatureCollection<Polygon | MultiPolygon, DestinationFeatureProperties>

/** The Boundary Layer renders exactly the destination features above —
 * this alias exists so the layer's own code reads in terms of "boundary"
 * (what it draws) rather than "destination" (where the data came from),
 * without being a second, independently-shaped type. */
export type BoundaryFeature = DestinationFeature
export type BoundaryFeatureCollection = DestinationFeatureCollection

/** Properties Mapbox GL itself attaches to a clustered point when
 * `cluster: true` is set on a source — not something this codebase
 * constructs, only a type for reading what a cluster click hands back. */
export interface ClusterFeatureProperties {
  cluster: true
  cluster_id: number
  point_count: number
  point_count_abbreviated: string
  [key: string]: unknown
}

export type ClusterFeature = Feature<Point, ClusterFeatureProperties>
