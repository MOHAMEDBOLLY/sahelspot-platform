import type { LngLat } from '../providers/mapProvider'
import type { VenueFeature } from '../types/features'

export interface PopupState {
  feature: VenueFeature
  coordinates: LngLat
}

export type PopupListener = (state: PopupState | null) => void

/**
 * Popup infrastructure only — no rendered UI (that's a later phase's
 * React component). Deliberately has zero knowledge of Mapbox: it only
 * tracks *which* venue feature is bound to the popup and *where*
 * (coordinates taken from the feature's own geometry, not queried from
 * the provider). A future popup component subscribes via `subscribe`
 * and renders whatever it wants from `PopupState`; the provider's only
 * job, if it needs the popup's screen position, is the coordinate
 * projection it already exposes for other purposes — nothing here calls
 * into `MapProvider` at all.
 */
export class PopupController {
  private state: PopupState | null = null
  private readonly listeners = new Set<PopupListener>()

  show(feature: VenueFeature): void {
    this.state = { feature, coordinates: coordinatesOf(feature) }
    this.notify()
  }

  update(feature: VenueFeature): void {
    if (!this.state) return
    this.state = { feature, coordinates: coordinatesOf(feature) }
    this.notify()
  }

  hide(): void {
    if (!this.state) return
    this.state = null
    this.notify()
  }

  getState(): PopupState | null {
    return this.state
  }

  subscribe(listener: PopupListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.state)
    }
  }
}

function coordinatesOf(feature: VenueFeature): LngLat {
  const [lng, lat] = feature.geometry.coordinates
  return { lng, lat }
}
