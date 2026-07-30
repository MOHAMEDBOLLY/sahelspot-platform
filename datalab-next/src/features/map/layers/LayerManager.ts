import type { MapProvider } from '../providers/mapProvider'
import type { MapLayer } from './types'

/**
 * Owns the ordered set of active `MapLayer`s and is the only thing
 * `MapEngine` talks to for layer lifecycle — `MapEngine` never calls
 * `provider.addSource`/`addLayer` itself. Mount order is registration
 * order, which doubles as GL draw order (later-registered layers paint
 * on top) — Destination Boundary before Venue/Cluster before Selection
 * keeps compounds under markers, matching how the architecture review's
 * layer stack is written top-to-bottom.
 *
 * Adding a future layer (heatmap, a new dataset, etc.) means writing one
 * more `MapLayer` and registering it here — no change to `MapEngine`,
 * the Provider Interface, or any existing layer.
 */
export class LayerManager {
  private layers = new Map<string, MapLayer>()

  register(layer: MapLayer): void {
    this.layers.set(layer.id, layer)
  }

  mountAll(provider: MapProvider): void {
    for (const layer of this.layers.values()) {
      layer.mount(provider)
    }
  }

  unmountAll(provider: MapProvider): void {
    for (const layer of this.layers.values()) {
      layer.unmount(provider)
    }
    this.layers.clear()
  }

  update<TData>(id: string, provider: MapProvider, data: TData): void {
    this.layers.get(id)?.update(provider, data)
  }

  get(id: string): MapLayer | undefined {
    return this.layers.get(id)
  }

  /** Phase 2 — the choke point `SelectionManager` writes selection
   * through (see `selection/SelectionManager.ts`), rather than calling
   * `provider.setFeatureState` itself. Selection logic never lives
   * inside a layer; a layer only ever *styles* a `selected`/`faded`
   * feature-state key via its own paint expressions, it doesn't set one. */
  setFeatureState(provider: MapProvider, sourceId: string, featureId: string | number, state: Record<string, unknown>): void {
    provider.setFeatureState(sourceId, featureId, state)
  }

  clearFeatureState(provider: MapProvider, sourceId: string, featureId?: string | number): void {
    provider.removeFeatureState(sourceId, featureId)
  }
}
