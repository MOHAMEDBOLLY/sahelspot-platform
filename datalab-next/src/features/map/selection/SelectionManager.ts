import type { MapProvider } from '../providers/mapProvider'
import type { LayerManager } from '../layers/LayerManager'

interface SelectedFeature {
  sourceId: string
  featureId: string | number
}

/**
 * Owns "what is currently selected" — deliberately not a concern of any
 * layer (per the architecture requirement: selection must not live
 * inside layers). `MapEngine` owns one `SelectionManager` instance;
 * `SelectionManager` only ever talks to `LayerManager` (never straight to
 * a `MapProvider`), so `LayerManager.setFeatureState` stays the single
 * choke point for feature-state writes.
 *
 * Foundation only in this phase: nothing calls `select`/`clear` yet — no
 * click handling exists (Phase 3, "Interaction"). The state key written
 * is `selected`; layers that want to *style* a selected feature
 * differently (e.g. the Boundary Layer's future "Compound Focus Mode")
 * read this same key in their own paint expressions.
 */
export class SelectionManager {
  private selected: SelectedFeature | null = null
  private readonly layerManager: LayerManager

  constructor(layerManager: LayerManager) {
    this.layerManager = layerManager
  }

  select(provider: MapProvider, sourceId: string, featureId: string | number): void {
    if (this.selected) {
      this.layerManager.clearFeatureState(provider, this.selected.sourceId, this.selected.featureId)
    }
    this.layerManager.setFeatureState(provider, sourceId, featureId, { selected: true })
    this.selected = { sourceId, featureId }
  }

  clear(provider: MapProvider): void {
    if (!this.selected) return
    this.layerManager.clearFeatureState(provider, this.selected.sourceId, this.selected.featureId)
    this.selected = null
  }

  getSelected(): SelectedFeature | null {
    return this.selected
  }
}
