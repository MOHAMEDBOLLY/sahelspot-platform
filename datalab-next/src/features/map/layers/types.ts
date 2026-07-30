import type { MapProvider } from '../providers/mapProvider'

/**
 * The contract every map layer implements — Destination Boundary, Venue,
 * Cluster, Selection, Popup, Controls, and any future layer. A layer
 * owns exactly one concern (one or more related sources/GL layers) and
 * only ever talks to the map through the `MapProvider` it's given —
 * never to `mapbox-gl` directly, never to another layer directly.
 *
 * `mount`/`unmount` add/remove the layer's sources and GL layers.
 * `update` is called whenever the layer's own input data changes (e.g.
 * the venue list after a filter change) — deliberately separate from
 * mount/unmount so a data refresh never means removing and re-adding GL
 * layers (which would flicker and is unnecessary GPU work).
 */
export interface MapLayer<TData = unknown> {
  id: string
  mount(provider: MapProvider): void
  unmount(provider: MapProvider): void
  update(provider: MapProvider, data: TData): void
}
