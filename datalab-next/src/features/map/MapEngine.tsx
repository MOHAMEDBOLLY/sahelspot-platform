import { useEffect, useRef, useState } from 'react'
import { MapboxAdapter } from './providers/mapboxAdapter'
import { LayerManager } from './layers/LayerManager'
import { SelectionManager } from './selection/SelectionManager'
import { CameraController } from './camera/CameraController'
import type { LngLat, MapProvider } from './providers/mapProvider'
import type { MapLayer } from './layers/types'

/** What `MapEngine` hands back once the provider has mounted and every
 * layer is registered — the concrete realization of "MapEngine →
 * SelectionManager → LayerManager" and the Camera API, all owned here
 * and handed outward rather than constructed ad hoc by callers. */
export interface MapEngineContext {
  provider: MapProvider
  camera: CameraController
  selection: SelectionManager
  layerManager: LayerManager
}

export type MapEngineProps = {
  accessToken: string
  center: LngLat
  zoom: number
  /** Declarative — Phase 1 passed `[]` (empty map); Phase 2 passes real
   * layers (Venue/Cluster/Boundary). Mount/unmount is driven entirely by
   * this array via the Layer Manager, read once at mount. */
  layers: MapLayer[]
  /** Phase 2 — per-layer data, keyed by layer id (see `LayerId`). Unlike
   * `layers` (mount-time config, static), this is watched for changes
   * and pushed through `LayerManager.update` on every change — this is
   * how real venue/destination data reaches an already-mounted map. */
  layerData?: Record<string, unknown>
  className?: string
  /** Which `MapProvider` implementation to construct — defaults to
   * `MapboxAdapter`. A hardening-pass fix: without this, swapping
   * providers (MapLibre, Google Maps, Leaflet) would mean editing this
   * component's body directly, contradicting "future providers swappable
   * without modifying React components." A caller (a page, a future
   * provider-selection setting) now supplies a different factory instead. */
  providerFactory?: () => MapProvider
  /** Fires once the underlying provider is ready. */
  onReady?: (context: MapEngineContext) => void
}

function defaultProviderFactory(): MapProvider {
  return new MapboxAdapter()
}

/**
 * The Map Engine — the only component anything in the UI layer imports
 * to get a map. Owns the `MapProvider`, `LayerManager`, `SelectionManager`,
 * and `CameraController` lifecycle; nothing above this component ever
 * touches `mapbox-gl` or even knows which provider is in use.
 */
export function MapEngine({
  accessToken,
  center,
  zoom,
  layers,
  layerData,
  className,
  providerFactory = defaultProviderFactory,
  onReady,
}: MapEngineProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const layerManagerRef = useRef(new LayerManager())
  const providerRef = useRef<MapProvider | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if (!containerRef.current) return

    const provider = providerFactory()
    const layerManager = layerManagerRef.current
    providerRef.current = provider

    provider.init(containerRef.current, { center, zoom, accessToken })

    const unsubscribeLoad = provider.onLoad(() => {
      for (const layer of layers) {
        layerManager.register(layer)
      }
      layerManager.mountAll(provider)
      const selection = new SelectionManager(layerManager)
      const camera = new CameraController(provider)
      setIsReady(true)
      onReady?.({ provider, camera, selection, layerManager })
    })

    return () => {
      unsubscribeLoad()
      setIsReady(false)
      layerManager.unmountAll(provider)
      provider.destroy()
      providerRef.current = null
    }
    // Mounted once. `center`/`zoom` are only the *initial* view — moving
    // the map afterwards goes through the Camera API, not by tearing down
    // and recreating the whole map on every prop change. `layers`/
    // `providerFactory`/`onReady` are read once at mount for the same
    // reason; `layerData` is intentionally NOT a dependency of this
    // effect (see the effect below) — data updates must never remount
    // the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!isReady || !layerData || !providerRef.current) return
    const provider = providerRef.current
    for (const [layerId, data] of Object.entries(layerData)) {
      layerManagerRef.current.update(layerId, provider, data)
    }
  }, [isReady, layerData])

  return (
    <div
      ref={containerRef}
      className={className ?? 'h-full w-full'}
      role="application"
      aria-label="Venue map"
    />
  )
}
