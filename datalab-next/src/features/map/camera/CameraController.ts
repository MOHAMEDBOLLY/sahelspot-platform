import { boundsOfFeatureCollection, boundsOfGeometry } from '../../../lib/geo/bounds'
import type { Bounds, FitBoundsOptions, FlyToOptions, MapProvider } from '../providers/mapProvider'
import type { DestinationFeature, VenueFeature, VenueFeatureCollection } from '../types/features'
import { MapLogger } from '../MapLogger'

/**
 * The Camera API — sits above `MapProvider`, adding the domain-aware
 * conveniences (`centerOnVenue`/`centerOnDestination`/`fitAllVenues`/
 * `fitDestination`) the Provider Interface deliberately doesn't know
 * about (it has no concept of "Venue"/"Destination", only GeoJSON/
 * LngLat/Bounds). Everything else here is a pure passthrough to the
 * provider's own camera primitives. Bounding-box math is never
 * reimplemented here — always `lib/geo/bounds.ts`.
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

  /** Fits the whole venues source at once (e.g. a "reset view" / initial
   * fit-to-data action) — reuses `boundsOfFeatureCollection`, the same
   * utility `MapExplorer`'s data layer already relies on. */
  fitAllVenues(venues: VenueFeatureCollection, options?: FitBoundsOptions): void {
    const bounds = boundsOfFeatureCollection(venues)
    if (!bounds) {
      MapLogger.warn('fitAllVenues called with an empty or unboundable collection')
      return
    }
    this.provider.fitBounds(bounds, options)
  }

  /** Same operation `centerOnDestination` already performs (fit to a
   * destination's boundary polygon) — kept as its own named method to
   * match the Camera API's naming, delegating rather than duplicating
   * the bounds computation. */
  fitDestination(destination: DestinationFeature, options?: FitBoundsOptions): void {
    this.centerOnDestination(destination, options)
  }
}
