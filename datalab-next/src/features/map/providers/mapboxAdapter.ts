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
import { MapEvent } from '../constants/MapEvent'
import { MapLogger } from '../MapLogger'

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

  easeTo(options: FlyToOptions): void {
    if (!this.map) return
    this.map.easeTo({
      center: [options.center.lng, options.center.lat],
      zoom: options.zoom,
      animate: !options.immediate,
    })
  }

  zoomTo(zoom: number, options: { immediate?: boolean } = {}): void {
    if (!this.map) return
    this.map.zoomTo(zoom, { animate: !options.immediate })
  }

  getBounds(): Bounds {
    if (!this.map) return [0, 0, 0, 0]
    const bounds = this.map.getBounds()
    if (!bounds) return [0, 0, 0, 0]
    return [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]
  }

  addSource(spec: MapSourceSpec): void {
    if (!this.map || this.map.getSource(spec.id)) return
    // Mapbox's style validator treats an explicitly-`undefined`-valued
    // key as "present but wrong type", not "absent" — so optional spec
    // fields must be omitted entirely when unset, never passed through
    // as `undefined`, or `addSource`/`addLayer` reject the whole call.
    this.map.addSource(spec.id, {
      type: 'geojson',
      data: spec.data,
      promoteId: 'id',
      ...(spec.cluster !== undefined && { cluster: spec.cluster }),
      ...(spec.clusterRadius !== undefined && { clusterRadius: spec.clusterRadius }),
      ...(spec.clusterMaxZoom !== undefined && { clusterMaxZoom: spec.clusterMaxZoom }),
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
        // This mapbox-gl version's style validator requires `layout`
        // and `filter` to be present on every layer (unlike `paint`,
        // which is genuinely optional) — omitting them fails validation
        // the same way an explicit `undefined` does, so a layer that
        // doesn't need them still needs the neutral defaults below
        // ("no layout properties set", "match every feature").
        layout: spec.layout ?? {},
        filter: spec.filter ?? true,
        ...(spec.paint !== undefined && { paint: spec.paint }),
      } as mapboxgl.AnyLayer,
      beforeId,
    )
  }

  removeLayer(id: string): void {
    if (this.map?.getLayer(id)) {
      this.map.removeLayer(id)
    }
  }

  setLayerVisibility(id: string, visible: boolean): void {
    if (!this.map?.getLayer(id)) {
      MapLogger.warn('setLayerVisibility called for a layer that is not mounted', { id })
      return
    }
    this.map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
  }

  getClusterExpansionZoom(sourceId: string, clusterId: number): Promise<number> {
    const source = this.map?.getSource(sourceId)
    if (!source || source.type !== 'geojson') {
      return Promise.reject(new Error(`No GeoJSON source "${sourceId}" to expand cluster ${clusterId} on`))
    }
    return new Promise((resolve, reject) => {
      ;(source as mapboxgl.GeoJSONSource).getClusterExpansionZoom(clusterId, (error, zoom) => {
        if (error || zoom === undefined || zoom === null) {
          reject(error ?? new Error('getClusterExpansionZoom returned no zoom'))
          return
        }
        resolve(zoom)
      })
    })
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
    this.map.on(MapEvent.Click, layerId, listener)
    return () => this.map?.off(MapEvent.Click, layerId, listener)
  }

  onBackgroundClick(layerIds: string[], handler: () => void): () => void {
    if (!this.map) return () => {}
    const listener = (event: mapboxgl.MapMouseEvent) => {
      const existingLayerIds = layerIds.filter((id) => this.map?.getLayer(id))
      const features = existingLayerIds.length
        ? this.map?.queryRenderedFeatures(event.point, { layers: existingLayerIds })
        : []
      if (!features || features.length === 0) {
        handler()
      }
    }
    this.map.on(MapEvent.Click, listener)
    return () => this.map?.off(MapEvent.Click, listener)
  }

  onLoad(handler: () => void): () => void {
    if (!this.map) return () => {}
    this.map.on(MapEvent.Load, handler)
    return () => this.map?.off(MapEvent.Load, handler)
  }

  on(event: MapEvent, handler: () => void): () => void {
    if (!this.map) return () => {}
    this.map.on(event, handler)
    return () => this.map?.off(event, handler)
  }

  getNativeInstance(): unknown {
    return this.map
  }
}
