import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
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
import { InteractionEvent } from '../features/map/interaction/InteractionEvent'
import { MapPopup } from '../features/map/components/MapPopup'
import { MapToolbar } from '../features/map/components/MapToolbar'
import { MobileMapToolbar } from '../features/map/components/MobileMapToolbar'
import { VenueDetailPanel } from '../features/map/components/VenueDetailPanel'
import { VENUE_CATEGORIES } from '../features/venues/venueCategories'
import { useIsMobile } from '../hooks/useIsMobile'
import type { MapLayer } from '../features/map/layers/types'
import type { MapEngineContext } from '../features/map/MapEngine'
import type { Venue } from '../types/venue'
import type { VenueFeatureCollection, DestinationFeatureCollection } from '../features/map/types/features'

const ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined

// North Coast, Egypt — a sensible default center. Fitting the view to
// real venue/destination bounds is a later phase's concern (Camera API
// interaction, not spatial data).
const DEFAULT_CENTER = { lng: 28.7, lat: 30.95 }
const DEFAULT_ZOOM = 10

const ALL_CATEGORIES = new Set<string>(VENUE_CATEGORIES)

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
 *
 * Phase 5 — Search/filters/view-controls/URL state. `venue` and
 * `destination` live in the URL (`useSearchParams`), and that is the
 * *only* place selection state is stored — there is deliberately no
 * parallel `useState<string | null>` for "the selected venue". Every
 * entry point (search, map click, panel/popup close, ESC) writes to the
 * same URL param; one effect reads it back out and is the only code
 * that ever calls `SelectionManager`/`PopupController`. That effect is
 * the single source of truth requirement from the Phase 5 spec, made
 * concrete: whatever the URL says is selected, IS selected, from
 * whichever direction the change came from (including the browser's
 * own back/forward buttons, which fall out of this for free). Category
 * filtering stays local (not in the URL) — the spec's URL examples list
 * venue/destination/zoom/center, not categories, and there's no bookmark
 * use case for "categories I had toggled off" the way there is for "the
 * venue/destination I was looking at".
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

  const [searchParams, setSearchParams] = useSearchParams()
  const selectedVenueId = searchParams.get('venue')
  const destinationId = searchParams.get('destination') ?? ''

  const [categoryFilter, setCategoryFilter] = useState<Set<string>>(ALL_CATEGORIES)

  const toggleCategory = useCallback((category: string) => {
    setCategoryFilter((previous) => {
      const next = new Set(previous)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }, [])

  const setDestinationId = useCallback(
    (id: string) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          if (id) next.set('destination', id)
          else next.delete('destination')
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const filteredVenues = useMemo(() => {
    if (!venues) return []
    return venues.filter(
      (venue) =>
        categoryFilter.has(venue.category) && (!destinationId || venue.destination.id === destinationId),
    )
  }, [venues, categoryFilter, destinationId])

  // Unfiltered lookups — selection/restore must work regardless of the
  // current filter state (e.g. a bookmarked URL for a venue outside
  // today's default filters). GeoJSON is generated exactly once here,
  // from the full lists; the filtered collections below are derived by
  // filtering the already-built *features* (using the properties the
  // conversion already put on them), never by calling
  // `venuesToFeatureCollection`/`destinationsToFeatureCollection` a
  // second time on the same data (Phase 6 perf review — this used to
  // run the venue conversion twice per render when a filter was active).
  const venueById = useMemo(() => new Map((venues ?? []).map((venue) => [venue.id, venue])), [venues])
  const allVenueFeatures = useMemo(() => venuesToFeatureCollection(venues ?? []), [venues])
  const allBoundaryFeatures = useMemo(
    () => destinationsToFeatureCollection(destinations ?? []),
    [destinations],
  )
  const venueFeatureById = useMemo(
    () => new Map(allVenueFeatures.features.map((feature) => [feature.properties.id, feature])),
    [allVenueFeatures],
  )

  const venueFeatures = useMemo<VenueFeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: allVenueFeatures.features.filter(
        (feature) =>
          categoryFilter.has(feature.properties.category) &&
          (!destinationId || feature.properties.destinationId === destinationId),
      ),
    }),
    [allVenueFeatures, categoryFilter, destinationId],
  )
  const boundaryFeatures = useMemo<DestinationFeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: destinationId
        ? allBoundaryFeatures.features.filter((feature) => feature.properties.id === destinationId)
        : allBoundaryFeatures.features,
    }),
    [allBoundaryFeatures, destinationId],
  )

  const layerData = useMemo(
    () => ({
      [LayerId.VENUES_SOURCE]: venueFeatures,
      [LayerId.DESTINATIONS_SOURCE]: boundaryFeatures,
    }),
    [venueFeatures, boundaryFeatures],
  )

  const [engineContext, setEngineContext] = useState<MapEngineContext | null>(null)
  const handleEngineReady = useCallback((context: MapEngineContext) => {
    setEngineContext(context)
  }, [])

  // Phase 6 accessibility — the popup/panel/bottom-sheet Close button is
  // typically what's focused when a selection is cleared; once it
  // clears, that button unmounts and focus would otherwise silently
  // fall back to `<body>`. Moving it to the map region explicitly (a
  // real, stable, keyboard-reachable landmark) keeps focus somewhere
  // meaningful instead of it just disappearing.
  const mapRegionRef = useRef<HTMLDivElement>(null)

  const clearSelection = useCallback(() => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        next.delete('venue')
        return next
      },
      { replace: true },
    )
    mapRegionRef.current?.focus()
  }, [setSearchParams])

  // The single sync point: URL → SelectionManager/PopupController.
  // Deliberately does not move the camera — map clicks already handle
  // their own conditional camera move inside the frozen
  // `InteractionController`, and running that again here for every
  // selection change (including ones that originated from a map click)
  // would fight that behavior. Search and URL-restore move the camera
  // explicitly at their own call sites instead (see below).
  useEffect(() => {
    if (!engineContext) return
    if (selectedVenueId) {
      const feature = venueFeatureById.get(selectedVenueId)
      if (!feature) return
      engineContext.selection.selectVenue(engineContext.provider, selectedVenueId)
      engineContext.popup.show(feature)
    } else {
      engineContext.selection.clearSelection(engineContext.provider)
      engineContext.popup.hide()
    }
  }, [engineContext, selectedVenueId, venueFeatureById])

  // Map clicks/background clicks only ever write the URL — the effect
  // above is what actually drives the controllers, so this is the one
  // and only place `InteractionController`'s events feed back into page
  // state.
  useEffect(() => {
    if (!engineContext) return
    return engineContext.interaction.subscribe((interaction) => {
      if (interaction.type === InteractionEvent.VenueClick) {
        setSearchParams(
          (previous) => {
            const next = new URLSearchParams(previous)
            next.set('venue', interaction.venue.properties.id)
            return next
          },
          { replace: true },
        )
      } else if (interaction.type === InteractionEvent.MapClick) {
        clearSelection()
      }
    })
  }, [engineContext, setSearchParams, clearSelection])

  // A filter change can drop the currently selected venue out of view —
  // deselect rather than leave a highlighted-but-invisible feature.
  // Gated on `venues` being loaded: while the query is still pending,
  // `filteredVenues` is legitimately `[]`, which must never be read as
  // "the selected venue got filtered out" and clear a URL-restored
  // selection before the data has even arrived.
  useEffect(() => {
    if (!venues || !selectedVenueId) return
    if (!filteredVenues.some((venue) => venue.id === selectedVenueId)) clearSelection()
  }, [venues, filteredVenues, selectedVenueId, clearSelection])

  // Restores the initial view exactly once, after both the engine and
  // the venue list are ready — a bookmarked/shared URL reopens to the
  // same venue (or destination) it was saved from.
  const hasRestoredRef = useRef(false)
  useEffect(() => {
    if (hasRestoredRef.current || !engineContext || !venues) return
    hasRestoredRef.current = true
    const initialVenueId = searchParams.get('venue')
    const initialDestinationId = searchParams.get('destination')
    if (initialVenueId) {
      const feature = venueFeatureById.get(initialVenueId)
      if (feature) engineContext.camera.centerOnVenue(feature)
    } else if (initialDestinationId) {
      const feature = allBoundaryFeatures.features.find((f) => f.properties.id === initialDestinationId)
      if (feature) engineContext.camera.fitDestination(feature)
    }
    // Deliberately excludes reactive deps (`searchParams`, feature maps)
    // — this must run exactly once, driven by `engineContext`/`venues`
    // becoming available, not by every subsequent URL change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineContext, venues])

  const handleSelectFromSearch = useCallback(
    (venue: Venue) => {
      const feature = venueFeatureById.get(venue.id)
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          next.set('venue', venue.id)
          return next
        },
        { replace: true },
      )
      if (feature && engineContext) engineContext.camera.centerOnVenue(feature)
    },
    [engineContext, venueFeatureById, setSearchParams],
  )

  const handleFitAll = useCallback(() => {
    engineContext?.camera.fitAllVenues(venueFeatures)
  }, [engineContext, venueFeatures])

  const handleFitDestination = useCallback(() => {
    if (!destinationId || !engineContext) return
    const feature = allBoundaryFeatures.features.find((f) => f.properties.id === destinationId)
    if (feature) engineContext.camera.fitDestination(feature)
  }, [engineContext, destinationId, allBoundaryFeatures])

  const handleResetView = useCallback(() => {
    engineContext?.camera.flyTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM })
  }, [engineContext])

  // ESC clears selection globally; Ctrl/Cmd+K to focus search is owned
  // by `MapSearch` itself (the only component that has the input ref).
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') clearSelection()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [clearSelection])

  const selectedVenue = selectedVenueId ? (venueById.get(selectedVenueId) ?? null) : null
  const isMobile = useIsMobile()

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

  const toolbarProps = {
    searchCandidates: filteredVenues,
    onSelectVenue: handleSelectFromSearch,
    categoryFilter,
    onToggleCategory: toggleCategory,
    destinations: destinations ?? [],
    destinationId,
    onDestinationIdChange: setDestinationId,
    onFitAll: handleFitAll,
    onFitDestination: handleFitDestination,
    onResetView: handleResetView,
    onClearSelection: clearSelection,
    hasSelection: Boolean(selectedVenueId),
  }

  return (
    <div className="-m-4 flex h-[calc(100vh-4rem)] flex-col sm:-m-6 lg:-m-8">
      {isMobile ? <MobileMapToolbar {...toolbarProps} /> : <MapToolbar {...toolbarProps} />}
      <div className="flex min-h-0 flex-1">
        <div ref={mapRegionRef} tabIndex={-1} className="relative flex-1 focus:outline-none">
          <MapEngine
            accessToken={ACCESS_TOKEN}
            center={DEFAULT_CENTER}
            zoom={DEFAULT_ZOOM}
            layers={MAP_LAYERS}
            layerData={layerData}
            onReady={handleEngineReady}
          />
          {engineContext && venues && (
            <MapPopup popup={engineContext.popup} venues={venues} onClose={clearSelection} />
          )}
          {venues && venues.length > 0 && filteredVenues.length === 0 && (
            <div
              role="status"
              className="pointer-events-none absolute inset-x-4 bottom-4 z-10 rounded-lg border border-gray-200 bg-white/95 px-3 py-2 text-center text-sm text-gray-600 shadow-lg"
            >
              No venues match the current filters.
            </div>
          )}
        </div>
        <VenueDetailPanel venue={selectedVenue} onClose={clearSelection} />
      </div>
    </div>
  )
}
