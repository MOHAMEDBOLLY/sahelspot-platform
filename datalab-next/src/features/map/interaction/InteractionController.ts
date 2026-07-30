import type { Feature, Geometry } from 'geojson'
import { LayerId } from '../constants/LayerId'
import { MapEvent } from '../constants/MapEvent'
import { MapLogger } from '../MapLogger'
import type { MapClickHandler, MapProvider } from '../providers/mapProvider'
import type { CameraController } from '../camera/CameraController'
import type { SelectionManager } from '../selection/SelectionManager'
import type { PopupController } from '../popup/PopupController'
import type { ClusterFeature, VenueFeature } from '../types/features'
import { InteractionEvent, type InteractionListener, type MapInteraction } from './InteractionEvent'

type ClickEvent = Parameters<MapClickHandler>[0]

/** Checked, not blind — same type-guard idiom already used by
 * `destinationToGeoJSON.ts`'s `isPolygonGeometry` (geometry + property
 * shape verified before the cast). `event.features` is typed generically
 * by the Provider Interface (`Array<Feature<Geometry>>`, no domain
 * knowledge); this is the one place that narrows it back to what the
 * Venue Layer actually produced. */
function asVenueFeature(feature: Feature<Geometry> | undefined): VenueFeature | null {
  if (!feature || feature.geometry.type !== 'Point') return null
  const properties = feature.properties as Record<string, unknown> | null
  if (!properties || typeof properties.id !== 'string') return null
  return feature as VenueFeature
}

function asClusterFeature(feature: Feature<Geometry> | undefined): ClusterFeature | null {
  if (!feature || feature.geometry.type !== 'Point') return null
  const properties = feature.properties as Record<string, unknown> | null
  if (!properties || properties.cluster !== true || typeof properties.cluster_id !== 'number') return null
  return feature as ClusterFeature
}

/**
 * Translates raw provider clicks/events into the typed `MapInteraction`
 * taxonomy and coordinates the three controllers that react to them
 * (Selection, Camera, Popup) — this is the one place those three are
 * wired together; none of them reference each other directly. Owned and
 * attached/detached by `MapEngine`, same lifecycle as everything else it
 * constructs.
 *
 * `MapClick` intentionally carries no coordinates: the Provider
 * Interface's generic `on()` (used for events without a per-feature
 * payload) doesn't return one, and adding that would mean a new Provider
 * capability beyond this phase's "no raw event strings, use what
 * already exists" scope. It still fires as a typed event for anything
 * that only needs to know *that* the map background was clicked.
 */
export class InteractionController {
  private readonly provider: MapProvider
  private readonly selection: SelectionManager
  private readonly camera: CameraController
  private readonly popup: PopupController
  private readonly listeners = new Set<InteractionListener>()
  private unsubscribers: Array<() => void> = []

  constructor(provider: MapProvider, selection: SelectionManager, camera: CameraController, popup: PopupController) {
    this.provider = provider
    this.selection = selection
    this.camera = camera
    this.popup = popup
  }

  attach(): void {
    this.unsubscribers = [
      this.provider.onClick(LayerId.VENUES_UNCLUSTERED, (event) => this.handleVenueClick(event)),
      this.provider.onClick(LayerId.CLUSTERS, (event) => this.handleClusterClick(event)),
      this.provider.onBackgroundClick([LayerId.VENUES_UNCLUSTERED, LayerId.CLUSTERS], () =>
        this.emit({ type: InteractionEvent.MapClick }),
      ),
      this.provider.on(MapEvent.MoveEnd, () =>
        this.emit({ type: InteractionEvent.MapMoveEnd, bounds: this.provider.getBounds() }),
      ),
      this.provider.on(MapEvent.Idle, () => this.emit({ type: InteractionEvent.MapIdle })),
    ]
  }

  detach(): void {
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe()
    }
    this.unsubscribers = []
  }

  subscribe(listener: InteractionListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Venue Click, exactly per spec: select, highlight (via feature-state
   * — see `VenueLayer`'s paint), move camera only if the venue isn't
   * already visible, notify the popup system. Nothing more — no
   * navigation, no list sync (later phase). */
  private handleVenueClick(event: ClickEvent): void {
    const venue = asVenueFeature(event.features[0])
    if (!venue) return

    this.selection.selectVenue(this.provider, venue.properties.id)

    const [lng, lat] = venue.geometry.coordinates
    if (!this.isWithinBounds(lng, lat)) {
      this.camera.centerOnVenue(venue)
    }

    this.popup.show(venue)
    this.emit({ type: InteractionEvent.VenueClick, venue })
  }

  /** Cluster Click: the standard interaction only — ask the provider's
   * native clustering what zoom breaks this cluster apart
   * (`getClusterExpansionZoom`) and ease there. No spiderfy, no custom
   * expansion animation, no custom clustering math. */
  private handleClusterClick(event: ClickEvent): void {
    const cluster = asClusterFeature(event.features[0])
    if (!cluster) return

    const [lng, lat] = cluster.geometry.coordinates
    const coordinates = { lng, lat }
    const { cluster_id: clusterId, point_count: pointCount } = cluster.properties

    this.emit({ type: InteractionEvent.ClusterClick, clusterId, pointCount, coordinates })

    this.provider
      .getClusterExpansionZoom(LayerId.VENUES_SOURCE, clusterId)
      .then((zoom) => this.camera.easeTo({ center: coordinates, zoom }))
      .catch((error: unknown) => {
        MapLogger.warn('Cluster expansion zoom lookup failed', { clusterId, error: String(error) })
      })
  }

  private isWithinBounds(lng: number, lat: number): boolean {
    const [west, south, east, north] = this.provider.getBounds()
    return lng >= west && lng <= east && lat >= south && lat <= north
  }

  private emit(interaction: MapInteraction): void {
    for (const listener of this.listeners) {
      listener(interaction)
    }
  }
}
