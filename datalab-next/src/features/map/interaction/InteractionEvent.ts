import type { Bounds, LngLat } from '../providers/mapProvider'
import type { VenueFeature } from '../types/features'

/**
 * Every interaction the Map Engine can notify about — no file dispatches
 * or matches against a raw string (`'venue-click'`, ...) directly, only
 * these members. Distinct from `MapEvent` (the low-level SDK event names
 * `MapboxAdapter` subscribes to internally) — this is the semantic,
 * provider-agnostic taxonomy `InteractionController` translates those
 * into.
 */
export const InteractionEvent = {
  VenueClick: 'venue-click',
  ClusterClick: 'cluster-click',
  MapClick: 'map-click',
  MapMoveEnd: 'map-moveend',
  MapIdle: 'map-idle',
} as const

export type InteractionEvent = (typeof InteractionEvent)[keyof typeof InteractionEvent]

export interface VenueClickInteraction {
  type: typeof InteractionEvent.VenueClick
  venue: VenueFeature
}

export interface ClusterClickInteraction {
  type: typeof InteractionEvent.ClusterClick
  clusterId: number
  pointCount: number
  coordinates: LngLat
}

/** Carries no payload today — see `InteractionController`'s docstring
 * for why a background click's coordinates aren't available without a
 * new Provider capability beyond this phase's scope. */
export interface MapClickInteraction {
  type: typeof InteractionEvent.MapClick
}

export interface MapMoveEndInteraction {
  type: typeof InteractionEvent.MapMoveEnd
  bounds: Bounds
}

export interface MapIdleInteraction {
  type: typeof InteractionEvent.MapIdle
}

export type MapInteraction =
  | VenueClickInteraction
  | ClusterClickInteraction
  | MapClickInteraction
  | MapMoveEndInteraction
  | MapIdleInteraction

export type InteractionListener = (interaction: MapInteraction) => void
