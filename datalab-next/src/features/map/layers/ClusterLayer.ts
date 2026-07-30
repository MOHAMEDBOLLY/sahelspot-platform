import { LayerId } from '../constants/LayerId'
import type { MapProvider } from '../providers/mapProvider'
import type { MapLayer } from './types'

/**
 * The clustering foundation — cluster circle + cluster-count label,
 * reading from the venues source `VenueLayer` owns (native Mapbox GL
 * clustering; no manual/JS clustering, no custom cluster UI, no
 * expansion animation or spiderfy yet — explicitly out of scope for this
 * phase). Must be registered (mounted) after `VenueLayer`, since these
 * GL layers reference a source `VenueLayer.mount` creates.
 *
 * Owns no source of its own and never calls `updateSource` — clusters
 * are computed by Mapbox from the venues source automatically whenever
 * `VenueLayer.update` pushes new data, so `update` here is a no-op.
 */
export class ClusterLayer implements MapLayer<void> {
  readonly id = LayerId.CLUSTERS

  mount(provider: MapProvider): void {
    provider.addLayer({
      id: LayerId.CLUSTERS,
      sourceId: LayerId.VENUES_SOURCE,
      type: 'circle',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#111827',
        'circle-radius': ['step', ['get', 'point_count'], 16, 25, 20, 100, 26],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
      },
    })

    provider.addLayer({
      id: LayerId.CLUSTER_COUNT,
      sourceId: LayerId.VENUES_SOURCE,
      type: 'symbol',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-size': 12,
        'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
      },
      paint: {
        'text-color': '#ffffff',
      },
    })
  }

  unmount(provider: MapProvider): void {
    provider.removeLayer(LayerId.CLUSTER_COUNT)
    provider.removeLayer(LayerId.CLUSTERS)
  }

  update(): void {
    // Intentionally empty — see class docstring.
  }
}
