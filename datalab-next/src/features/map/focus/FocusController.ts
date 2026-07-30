import type { CameraController } from '../camera/CameraController'
import type { LngLat } from '../providers/mapProvider'
import type { VenueFeature } from '../types/features'

export interface DefaultView {
  center: LngLat
  zoom: number
}

/**
 * Camera "focus" — remembering what's currently focused so it can be
 * cleared or reverted to a default view. Deliberately separate from
 * `SelectionManager`: focusing a venue never selects it, and selecting a
 * venue (elsewhere) never focuses it — the two are independent concerns
 * that happen to often be triggered together by the same click (see
 * `InteractionController`), not the same concern. All camera movement is
 * delegated to `CameraController` — this class holds no camera logic of
 * its own, only the "what is focused" state.
 */
export class FocusController {
  private readonly camera: CameraController
  private readonly defaultView: DefaultView
  private focusedVenueId: string | null = null

  constructor(camera: CameraController, defaultView: DefaultView) {
    this.camera = camera
    this.defaultView = defaultView
  }

  focusVenue(venue: VenueFeature): void {
    this.focusedVenueId = venue.properties.id
    this.camera.centerOnVenue(venue)
  }

  clearFocus(): void {
    this.focusedVenueId = null
  }

  restoreDefaultView(): void {
    this.focusedVenueId = null
    this.camera.flyTo({ center: this.defaultView.center, zoom: this.defaultView.zoom })
  }

  getFocusedVenueId(): string | null {
    return this.focusedVenueId
  }
}
