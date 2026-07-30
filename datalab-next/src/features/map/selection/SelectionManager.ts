import type { MapProvider } from '../providers/mapProvider'
import type { LayerManager } from '../layers/LayerManager'
import { LayerId } from '../constants/LayerId'

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
 * `selectVenue`/`clearSelection` (Phase 3) are venue-domain sugar over
 * the generic `select`/`clear` — V1 only ever selects venues, so
 * `InteractionController` uses these rather than passing `LayerId
 * .VENUES_SOURCE` around itself. The state key written is `selected`;
 * `VenueLayer`'s paint expressions read this same key to render the
 * highlight — the layer never sets it, only styles it.
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

  /** Selecting a new venue automatically clears whatever was selected
   * before — the same guarantee `select` already provides, just under
   * the venue-specific name `VENUE CLICK` calls for. */
  selectVenue(provider: MapProvider, venueId: string): void {
    this.select(provider, LayerId.VENUES_SOURCE, venueId)
  }

  clearSelection(provider: MapProvider): void {
    this.clear(provider)
  }
}
