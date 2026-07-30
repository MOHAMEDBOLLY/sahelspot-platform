import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type {
  Bounds,
  FitBoundsOptions,
  FlyToOptions,
  LngLat,
  MapClickHandler,
  MapLayerSpec,
  MapProvider,
  MapSourceSpec,
} from './mapProvider'

/**
 * The Mapbox Adapter — the only file in this codebase that imports
 * `mapbox-gl`. Implements `MapProvider` exactly; nothing here is called
 * directly by the Layer Manager or any UI component (see `MapEngine`,
 * which is the sole consumer). Swapping providers later means writing a
 * new file like this one, not touching anything upstream of it.
 */
export class MapboxAdapter implements MapProvider {
  private map: mapboxgl.Map | null = null

  init(container: HTMLElement, options: { center: LngLat; zoom: number; accessToken: string }): void {
    mapboxgl.accessToken = options.accessToken
    this.map = new mapboxgl.Map({
      container,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [options.center.lng, options.center.lat],
      zoom: options.zoom,
      attributionControl: true,
    })
  }

  destroy(): void {
    this.map?.remove()
    this.map = null
  }

  resize(): void {
    this.map?.resize()
  }

  flyTo(options: FlyToOptions): void {
    if (!this.map) return
    if (options.immediate) {
      this.map.jumpTo({ center: [options.center.lng, options.center.lat], zoom: options.zoom })
      return
    }
    this.map.flyTo({ center: [options.center.lng, options.center.lat], zoom: options.zoom })
  }

  fitBounds(bounds: Bounds, options: FitBoundsOptions = {}): void {
    if (!this.map) return
    this.map.fitBounds(
      [
        [bounds[0], bounds[1]],
        [bounds[2], bounds[3]],
      ],
      { padding: options.padding ?? 40, animate: !options.immediate },
    )
  }

  getBounds(): Bounds {
    if (!this.map) return [0, 0, 0, 0]
    const bounds = this.map.getBounds()
    if (!bounds) return [0, 0, 0, 0]
    return [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]
  }

  addSource(spec: MapSourceSpec): void {
    if (!this.map || this.map.getSource(spec.id)) return
    this.map.addSource(spec.id, {
      type: 'geojson',
      data: spec.data,
      cluster: spec.cluster,
      clusterRadius: spec.clusterRadius,
      clusterMaxZoom: spec.clusterMaxZoom,
      promoteId: 'id',
    })
  }

  updateSource(id: string, data: FeatureCollection | Feature<Geometry>): void {
    const source = this.map?.getSource(id)
    if (source && source.type === 'geojson') {
      ;(source as mapboxgl.GeoJSONSource).setData(data)
    }
  }

  removeSource(id: string): void {
    if (this.map?.getSource(id)) {
      this.map.removeSource(id)
    }
  }

  addLayer(spec: MapLayerSpec, beforeId?: string): void {
    if (!this.map || this.map.getLayer(spec.id)) return
    this.map.addLayer(
      {
        id: spec.id,
        source: spec.sourceId,
        type: spec.type,
        paint: spec.paint,
        layout: spec.layout,
        filter: spec.filter,
      } as mapboxgl.AnyLayer,
      beforeId,
    )
  }

  removeLayer(id: string): void {
    if (this.map?.getLayer(id)) {
      this.map.removeLayer(id)
    }
  }

  setFeatureState(sourceId: string, featureId: string | number, state: Record<string, unknown>): void {
    this.map?.setFeatureState({ source: sourceId, id: featureId }, state)
  }

  removeFeatureState(sourceId: string, featureId?: string | number): void {
    this.map?.removeFeatureState({ source: sourceId, id: featureId })
  }

  onClick(layerId: string, handler: MapClickHandler): () => void {
    if (!this.map) return () => {}
    const listener = (event: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
      handler({
        lngLat: { lng: event.lngLat.lng, lat: event.lngLat.lat },
        point: { x: event.point.x, y: event.point.y },
        features: (event.features ?? []) as unknown as Array<Feature<Geometry>>,
      })
    }
    this.map.on('click', layerId, listener)
    return () => this.map?.off('click', layerId, listener)
  }

  onLoad(handler: () => void): () => void {
    if (!this.map) return () => {}
    this.map.on('load', handler)
    return () => this.map?.off('load', handler)
  }

  getNativeInstance(): unknown {
    return this.map
  }
}
