import { LayerId } from '../constants/LayerId'
import { buildVenueCategoryColorExpression } from '../styling/venueMarkerStyle'
import type { MapProvider } from '../providers/mapProvider'
import type { VenueFeatureCollection } from '../types/features'
import type { MapLayer } from './types'

const EMPTY_COLLECTION: VenueFeatureCollection = { type: 'FeatureCollection', features: [] }

/**
 * Owns the venues GeoJSON source (clustered — `cluster: true` is set
 * here) and the unclustered-point rendering layer only. The Cluster
 * Layer owns the cluster-specific GL layers that read from this same
 * source — kept separate per the "each layer must be isolated"
 * requirement, even though both ultimately describe "venues."
 *
 * Marker color is data-driven per category (`buildVenueCategoryColorExpression`)
 * — no single marker style, per the architecture decision. Popups and
 * click handling are not part of this layer (later phase).
 */
export class VenueLayer implements MapLayer<VenueFeatureCollection> {
  readonly id = LayerId.VENUES_SOURCE

  mount(provider: MapProvider): void {
    provider.addSource({
      id: LayerId.VENUES_SOURCE,
      data: EMPTY_COLLECTION,
      cluster: true,
      clusterRadius: 50,
      clusterMaxZoom: 14,
    })

    provider.addLayer({
      id: LayerId.VENUES_UNCLUSTERED,
      sourceId: LayerId.VENUES_SOURCE,
      type: 'circle',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': 7,
        'circle-color': buildVenueCategoryColorExpression(),
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
      },
    })
  }

  unmount(provider: MapProvider): void {
    provider.removeLayer(LayerId.VENUES_UNCLUSTERED)
    provider.removeSource(LayerId.VENUES_SOURCE)
  }

  update(provider: MapProvider, data: VenueFeatureCollection): void {
    provider.updateSource(LayerId.VENUES_SOURCE, data)
  }
}
