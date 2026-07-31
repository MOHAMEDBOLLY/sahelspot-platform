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
  private unsubscribeHover: (() => void) | null = null

  mount(provider: MapProvider): void {
    // Soft halo beneath the cluster circle — a blurred, larger, low-
    // opacity copy of the same circle, standing in for a CSS box-shadow
    // (GL canvas has no such concept). Added first so it paints below
    // the solid circle. Radius steps match the main circle's, just
    // scaled up, so the halo grows/shrinks in lockstep at each count
    // breakpoint rather than needing its own expression maintained in
    // parallel.
    provider.addLayer({
      id: LayerId.CLUSTER_HALO,
      sourceId: LayerId.VENUES_SOURCE,
      type: 'circle',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#0F172A',
        'circle-opacity': 0.18,
        'circle-blur': 1,
        'circle-radius': ['step', ['get', 'point_count'], 22, 25, 27, 100, 34],
        'circle-radius-transition': { duration: 200 },
      },
    })

    provider.addLayer({
      id: LayerId.CLUSTERS,
      sourceId: LayerId.VENUES_SOURCE,
      type: 'circle',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#0F172A',
        'circle-radius': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          ['+', ['step', ['get', 'point_count'], 16, 25, 20, 100, 26], 2],
          ['step', ['get', 'point_count'], 16, 25, 20, 100, 26],
        ],
        'circle-radius-transition': { duration: 150 },
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-opacity': 0.95,
      },
    })

    provider.addLayer({
      id: LayerId.CLUSTER_COUNT,
      sourceId: LayerId.VENUES_SOURCE,
      type: 'symbol',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-size': 13,
        'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
      },
      paint: {
        'text-color': '#ffffff',
      },
    })

    this.unsubscribeHover = provider.onHover(LayerId.CLUSTERS, LayerId.VENUES_SOURCE)
  }

  unmount(provider: MapProvider): void {
    this.unsubscribeHover?.()
    this.unsubscribeHover = null
    provider.removeLayer(LayerId.CLUSTER_COUNT)
    provider.removeLayer(LayerId.CLUSTERS)
    provider.removeLayer(LayerId.CLUSTER_HALO)
  }

  update(): void {
    // Intentionally empty — see class docstring.
  }
}
