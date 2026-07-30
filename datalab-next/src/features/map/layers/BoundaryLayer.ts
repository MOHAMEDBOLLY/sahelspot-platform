import { LayerId } from '../constants/LayerId'
import type { MapProvider } from '../providers/mapProvider'
import type { BoundaryFeatureCollection } from '../types/features'
import type { MapLayer } from './types'

const EMPTY_COLLECTION: BoundaryFeatureCollection = { type: 'FeatureCollection', features: [] }

/**
 * Read-only rendering of destination boundary polygons — no drawing, no
 * editing (the API already supports writing `boundary`, but this layer
 * never calls it). Fill + outline only in this phase; selected/faded
 * "Compound Focus Mode" styling (per the architecture review) is a later
 * phase's concern and would extend this layer's paint via feature-state,
 * not replace it.
 */
export class BoundaryLayer implements MapLayer<BoundaryFeatureCollection> {
  readonly id = LayerId.DESTINATIONS_SOURCE

  mount(provider: MapProvider): void {
    provider.addSource({ id: LayerId.DESTINATIONS_SOURCE, data: EMPTY_COLLECTION })

    provider.addLayer({
      id: LayerId.BOUNDARIES_FILL,
      sourceId: LayerId.DESTINATIONS_SOURCE,
      type: 'fill',
      paint: {
        'fill-color': '#0EA5E9',
        'fill-opacity': 0.12,
      },
    })

    provider.addLayer({
      id: LayerId.BOUNDARIES_LINE,
      sourceId: LayerId.DESTINATIONS_SOURCE,
      type: 'line',
      paint: {
        'line-color': '#0EA5E9',
        'line-width': 1.5,
      },
    })
  }

  unmount(provider: MapProvider): void {
    provider.removeLayer(LayerId.BOUNDARIES_LINE)
    provider.removeLayer(LayerId.BOUNDARIES_FILL)
    provider.removeSource(LayerId.DESTINATIONS_SOURCE)
  }

  update(provider: MapProvider, data: BoundaryFeatureCollection): void {
    provider.updateSource(LayerId.DESTINATIONS_SOURCE, data)
  }

  /** The "visibility toggle" requirement — not wired to any UI control
   * yet (no UI redesign this phase), but the capability exists on the
   * layer itself. */
  setVisible(provider: MapProvider, visible: boolean): void {
    provider.setLayerVisibility(LayerId.BOUNDARIES_FILL, visible)
    provider.setLayerVisibility(LayerId.BOUNDARIES_LINE, visible)
  }
}
