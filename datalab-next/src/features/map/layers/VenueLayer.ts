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
 * click handling are not part of this layer.
 *
 * Phase 3: paint also reads the `selected` feature-state key to render
 * the "highlight marker" requirement — this layer only *styles* that
 * key, it never sets it (`SelectionManager`/`LayerManager` do, via
 * `InteractionController`). Ownership vs. rendering stays split exactly
 * as the Selection architecture requires.
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
        'circle-radius': ['case', ['boolean', ['feature-state', 'selected'], false], 10, 7],
        'circle-radius-transition': { duration: 150 },
        'circle-color': buildVenueCategoryColorExpression(),
        'circle-stroke-width': ['case', ['boolean', ['feature-state', 'selected'], false], 3, 2],
        'circle-stroke-width-transition': { duration: 150 },
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
