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
  private unsubscribeHover: (() => void) | null = null

  mount(provider: MapProvider): void {
    provider.addSource({ id: LayerId.DESTINATIONS_SOURCE, data: EMPTY_COLLECTION })

    // More restraint at rest (8% vs. the previous 12%) so a resting
    // compound reads as a quiet outline, not a filled shape competing
    // with venue markers; the hover state (feature-state, same
    // mechanism as venue `selected`) is what makes a compound feel
    // interactive on pointer-over, not a permanently-heavier fill.
    provider.addLayer({
      id: LayerId.BOUNDARIES_FILL,
      sourceId: LayerId.DESTINATIONS_SOURCE,
      type: 'fill',
      paint: {
        'fill-color': '#0EA5E9',
        'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.22, 0.08],
        'fill-opacity-transition': { duration: 150 },
      },
    })

    provider.addLayer({
      id: LayerId.BOUNDARIES_LINE,
      sourceId: LayerId.DESTINATIONS_SOURCE,
      type: 'line',
      paint: {
        'line-color': '#0EA5E9',
        'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 2.5, 1.5],
        'line-width-transition': { duration: 150 },
      },
    })

    this.unsubscribeHover = provider.onHover(LayerId.BOUNDARIES_FILL, LayerId.DESTINATIONS_SOURCE)
  }

  unmount(provider: MapProvider): void {
    this.unsubscribeHover?.()
    this.unsubscribeHover = null
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
