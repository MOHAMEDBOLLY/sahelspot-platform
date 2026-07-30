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
}
