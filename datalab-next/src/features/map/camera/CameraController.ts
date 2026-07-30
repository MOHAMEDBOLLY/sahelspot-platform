import { boundsOfGeometry } from '../../../lib/geo/bounds'
import type { Bounds, FitBoundsOptions, FlyToOptions, MapProvider } from '../providers/mapProvider'
import type { DestinationFeature, VenueFeature } from '../types/features'
import { MapLogger } from '../MapLogger'

/**
 * The Camera API — sits above `MapProvider`, adding the two domain-aware
 * conveniences (`centerOnVenue`/`centerOnDestination`) the Provider
 * Interface deliberately doesn't know about (it has no concept of
 * "Venue"/"Destination", only GeoJSON/LngLat/Bounds). Everything else
 * here is a pure passthrough to the provider's own camera primitives.
 *
 * Partially implemented per this phase's scope: the primitives
 * (fitBounds/flyTo/easeTo/zoomTo) and the two domain methods all exist
 * and work; nothing calls them yet (no click/selection interaction until
 * a later phase).
 */
export class CameraController {
  private readonly provider: MapProvider

  constructor(provider: MapProvider) {
    this.provider = provider
  }

  fitBounds(bounds: Bounds, options?: FitBoundsOptions): void {
    this.provider.fitBounds(bounds, options)
  }

  flyTo(options: FlyToOptions): void {
    this.provider.flyTo(options)
  }

  easeTo(options: FlyToOptions): void {
    this.provider.easeTo(options)
  }

  zoomTo(zoom: number, options?: { immediate?: boolean }): void {
    this.provider.zoomTo(zoom, options)
  }

  centerOnVenue(venue: VenueFeature, zoom = 16): void {
    const [lng, lat] = venue.geometry.coordinates
    this.provider.flyTo({ center: { lng, lat }, zoom })
  }

  centerOnDestination(destination: DestinationFeature, options?: FitBoundsOptions): void {
    const bounds = boundsOfGeometry(destination.geometry)
    if (!bounds) {
      MapLogger.warn('centerOnDestination called with an unboundable geometry', {
        destinationId: destination.properties.id,
      })
      return
    }
    this.provider.fitBounds(bounds, options)
  }
}
