import { useMemo } from 'react'
import { MapPinOff } from 'lucide-react'
import { MapEngine } from '../features/map/MapEngine'
import { PagePlaceholder } from '../components/PagePlaceholder'
import { LoadingState } from '../components/LoadingState'
import { ErrorState } from '../components/ErrorState'
import { useAllVenues } from '../features/stats/useAllVenues'
import { useAllDestinations } from '../features/stats/useAllDestinations'
import { venuesToFeatureCollection } from '../features/map/geo/venueToGeoJSON'
import { destinationsToFeatureCollection } from '../features/map/geo/destinationToGeoJSON'
import { VenueLayer } from '../features/map/layers/VenueLayer'
import { ClusterLayer } from '../features/map/layers/ClusterLayer'
import { BoundaryLayer } from '../features/map/layers/BoundaryLayer'
import { LayerId } from '../features/map/constants/LayerId'
import type { MapLayer } from '../features/map/layers/types'

const ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined

// North Coast, Egypt — a sensible default center. Fitting the view to
// real venue/destination bounds is a later phase's concern (Camera API
// interaction, not spatial data).
const DEFAULT_CENTER = { lng: 28.7, lat: 30.95 }
const DEFAULT_ZOOM = 10

// Stateless layer instances, module-scoped so they're allocated exactly
// once (per module load), not once per MapExplorer render. Order matters
// — see the docstring below. `useRef([...])` was the original approach
// here but still evaluates the array literal (three `new` calls) on
// every render before discarding it, since only the *assignment* into a
// ref is skipped after the first render, not the initializer expression.
const MAP_LAYERS: MapLayer[] = [new BoundaryLayer(), new VenueLayer(), new ClusterLayer()]

/**
 * Full-bleed layout is solved entirely here, per the architecture
 * decision to avoid a special AppShell mode: `AppShell`'s `<main>` has a
 * fixed, responsive padding (`p-4 sm:p-6 lg:p-8`) and a fixed-height
 * header (`h-16` = 4rem, border-box, so its rendered height never
 * changes regardless of safe-area insets). This wrapper cancels exactly
 * that padding with matching negative margins and sizes itself to
 * `100vh` minus the header — filling all remaining viewport space
 * without AppShell needing to know Maps exists. Every other page is
 * completely unaffected.
 *
 * Data reuses the existing `useAllVenues`/`useAllDestinations` hooks
 * (already used by Dashboard/Quality Center) — no new fetching
 * mechanism. Layer registration order matters: Boundary before Venue
 * before Cluster, so compounds draw beneath markers and the venues
 * source exists before the Cluster Layer's GL layers reference it (see
 * `LayerManager`'s docstring on mount-order-as-draw-order).
 */
export function MapExplorer() {
  const { data: venues, isPending: isVenuesPending, isError: isVenuesError, error: venuesError, refetch: refetchVenues } =
    useAllVenues()
  const {
    data: destinations,
    isPending: isDestinationsPending,
    isError: isDestinationsError,
    error: destinationsError,
    refetch: refetchDestinations,
  } = useAllDestinations()

  const venueFeatures = useMemo(() => (venues ? venuesToFeatureCollection(venues) : null), [venues])
  const boundaryFeatures = useMemo(
    () => (destinations ? destinationsToFeatureCollection(destinations) : null),
    [destinations],
  )

  const layerData = useMemo(() => {
    if (!venueFeatures || !boundaryFeatures) return undefined
    return {
      [LayerId.VENUES_SOURCE]: venueFeatures,
      [LayerId.DESTINATIONS_SOURCE]: boundaryFeatures,
    }
  }, [venueFeatures, boundaryFeatures])

  if (!ACCESS_TOKEN) {
    return (
      <PagePlaceholder
        icon={MapPinOff}
        title="Map unavailable"
        description="VITE_MAPBOX_ACCESS_TOKEN is not set. Copy .env.example to .env.local (or set it in the deployment environment) and reload."
      />
    )
  }

  if (isVenuesPending || isDestinationsPending) {
    return <LoadingState label="Loading map data…" />
  }

  if (isVenuesError) {
    return (
      <ErrorState
        message={venuesError instanceof Error ? venuesError.message : 'Failed to load venues.'}
        onRetry={() => refetchVenues()}
      />
    )
  }

  if (isDestinationsError) {
    return (
      <ErrorState
        message={destinationsError instanceof Error ? destinationsError.message : 'Failed to load destinations.'}
        onRetry={() => refetchDestinations()}
      />
    )
  }

  return (
    <div className="-m-4 h-[calc(100vh-4rem)] sm:-m-6 lg:-m-8">
      <MapEngine
        accessToken={ACCESS_TOKEN}
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        layers={MAP_LAYERS}
        layerData={layerData}
      />
    </div>
  )
}
