import { useEffect, useRef } from 'react'
import { MapboxAdapter } from './providers/mapboxAdapter'
import { LayerManager } from './layers/LayerManager'
import type { LngLat, MapProvider } from './providers/mapProvider'
import type { MapLayer } from './layers/types'

export type MapEngineProps = {
  accessToken: string
  center: LngLat
  zoom: number
  /** Declarative — Phase 1 passes `[]` (empty map). Later phases add
   * Venue/Boundary/Cluster/Selection/Popup/Controls layers here with no
   * change to this component: mount/unmount is driven entirely by this
   * array via the Layer Manager. */
  layers: MapLayer[]
  className?: string
  /** Fires once the underlying provider is ready — later phases use this
   * to reach the provider imperatively (fitBounds on load, etc.) without
   * `MapEngine` needing to know what any caller wants to do with it. */
  onReady?: (provider: MapProvider) => void
}

/**
 * The Map Engine — the only component anything in the UI layer imports
 * to get a map. Owns the `MapProvider` instance and the `LayerManager`
 * lifecycle; nothing above this component ever touches `mapbox-gl` or
 * even knows which provider is in use.
 */
export function MapEngine({ accessToken, center, zoom, layers, className, onReady }: MapEngineProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const layerManagerRef = useRef(new LayerManager())

  useEffect(() => {
    if (!containerRef.current) return

    const provider = new MapboxAdapter()
    const layerManager = layerManagerRef.current

    provider.init(containerRef.current, { center, zoom, accessToken })

    const unsubscribeLoad = provider.onLoad(() => {
      for (const layer of layers) {
        layerManager.register(layer)
      }
      layerManager.mountAll(provider)
      onReady?.(provider)
    })

    return () => {
      unsubscribeLoad()
      layerManager.unmountAll(provider)
      provider.destroy()
    }
    // Mounted once. `center`/`zoom` are only the *initial* view — moving
    // the map afterwards goes through the provider's imperative
    // flyTo/fitBounds (later phases), not by tearing down and recreating
    // the whole map on every prop change. `layers`/`onReady` are read
    // once at mount for the same reason; a later phase that needs layers
    // to change after mount does so via the layer's own `update`, not by
    // re-running this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      ref={containerRef}
      className={className ?? 'h-full w-full'}
      role="application"
      aria-label="Venue map"
    />
  )
}
