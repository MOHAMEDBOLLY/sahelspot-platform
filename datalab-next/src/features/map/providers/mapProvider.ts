import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type { MapEvent } from '../constants/MapEvent'

/**
 * The Provider Interface — the one contract the rest of the Maps feature
 * (Map Engine, Layer Manager, every layer) is written against. No file
 * outside `providers/` may import `mapbox-gl` directly; everything here
 * uses plain GeoJSON and provider-neutral types, so swapping the adapter
 * (MapLibre, Google Maps JS, etc. later) never requires touching the
 * Layer Manager, any layer, or any UI component.
 *
 * Deliberately small and imperative (mirrors what a map SDK actually
 * offers) — the declarative React layer (`MapEngine`) is what turns prop
 * changes into calls against this interface, not the interface itself.
 */

export type LngLat = { lng: number; lat: number }

/** [west, south, east, north] — the standard GeoJSON/most-map-SDKs bbox
 * order, used instead of a provider's own bounds type. */
export type Bounds = [number, number, number, number]

export interface FitBoundsOptions {
  /** Pixels of padding on every side, so a fitted polygon/marker set
   * isn't flush against the viewport edge (e.g. under a side panel). */
  padding?: number
  /** Skip the flight animation — used for the very first render. */
  immediate?: boolean
}

export interface FlyToOptions {
  center: LngLat
  zoom?: number
  immediate?: boolean
}

/** A GeoJSON source the provider tracks by id — layers reference sources
 * by this same id when they're added. Updating a source's `data` is how
 * a layer's content changes (e.g. venues after a filter change); it is
 * NOT how selection/highlight state changes (see `setFeatureState`). */
export interface MapSourceSpec {
  id: string
  data: FeatureCollection | Feature<Geometry>
  /** Native clustering — only meaningful for point sources (the Venue
   * Layer). Ignored by the adapter for non-point data. */
  cluster?: boolean
  clusterRadius?: number
  clusterMaxZoom?: number
}

/** A style layer bound to a source. Deliberately a passthrough of
 * standard Mapbox-GL-style-spec shapes (type/paint/layout) rather than a
 * fully abstracted styling DSL — GL style expressions are themselves a
 * de facto standard (MapLibre, and most vector-tile-based SDKs, consume
 * the same spec), so this is provider-neutral in practice, not a Mapbox
 * leak, and keeps the Provider Interface from having to reinvent data-
 * driven styling (needed for §4's per-category marker styling and §5's
 * selected/faded compound states). */
export interface MapLayerSpec {
  id: string
  sourceId: string
  type: 'circle' | 'symbol' | 'fill' | 'line'
  paint?: Record<string, unknown>
  layout?: Record<string, unknown>
  filter?: unknown[]
}

export type MapClickHandler = (event: {
  lngLat: LngLat
  point: { x: number; y: number }
  features: Array<Feature<Geometry>>
}) => void

export interface MapProvider {
  /** Mounts the map into `container`. Must be called exactly once per
   * instance; `destroy()` tears it down. */
  init(container: HTMLElement, options: { center: LngLat; zoom: number; accessToken: string }): void
  destroy(): void
  /** Must be called after the container's size changes (e.g. a sidebar
   * toggling, a bottom sheet expanding) — GL contexts don't auto-detect
   * CSS-driven resizes. */
  resize(): void

  flyTo(options: FlyToOptions): void
  fitBounds(bounds: Bounds, options?: FitBoundsOptions): void
  getBounds(): Bounds
  /** Phase 2 Camera API — an un-animated (or lightly animated) camera
   * transition, distinct from `flyTo`'s arc animation. */
  easeTo(options: FlyToOptions): void
  /** Phase 2 Camera API — zoom only, center unchanged. */
  zoomTo(zoom: number, options?: { immediate?: boolean }): void

  addSource(spec: MapSourceSpec): void
  updateSource(id: string, data: FeatureCollection | Feature<Geometry>): void
  removeSource(id: string): void

  addLayer(spec: MapLayerSpec, beforeId?: string): void
  removeLayer(id: string): void
  /** Phase 2 — the Boundary Layer's visibility-toggle requirement. */
  setLayerVisibility(id: string, visible: boolean): void

  /** Per-feature ephemeral state (selected/highlighted/faded) — the
   * mechanism every "selection" and "focus mode" interaction must use
   * (§5, §10 of the architecture review) instead of rebuilding a source,
   * so selecting a marker or a compound never re-renders the layer's
   * full dataset. */
  setFeatureState(sourceId: string, featureId: string | number, state: Record<string, unknown>): void
  removeFeatureState(sourceId: string, featureId?: string | number): void

  onClick(layerId: string, handler: MapClickHandler): () => void
  onLoad(handler: () => void): () => void
  /** Phase 2 — generic subscription for events with no per-feature
   * payload (MoveEnd/Zoom/StyleLoaded). Click stays its own method since
   * it needs a layer id and returns hit-tested features; Load stays its
   * own method since every existing caller already depends on it
   * (Phase 1, unchanged). Nothing outside `MapboxAdapter` passes a raw
   * event string here — always a `MapEvent` member. */
  on(event: MapEvent, handler: () => void): () => void

  /** Escape hatch for the one thing the interface can't reasonably
   * abstract (converting a screen point / feature query in ways specific
   * to the underlying SDK). Adapter-typed as `unknown` here so this file
   * still never imports `mapbox-gl`; callers that need it must be inside
   * `providers/`, never in the Layer Manager or UI. Expected to stay
   * unused outside the adapter itself. */
  getNativeInstance(): unknown
}
