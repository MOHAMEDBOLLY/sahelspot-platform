import { useMemo } from 'react'
import { AtSign, Camera, Globe, MapPin, Phone, Store, Tag } from 'lucide-react'
import { usePlatformStats } from '../features/stats/usePlatformStats'
import { useAllVenues } from '../features/stats/useAllVenues'
import { useAllDestinations } from '../features/stats/useAllDestinations'
import { StatTile } from '../features/stats/StatTile'
import { DashboardCard } from '../components/DashboardCard'
import { StatusBreakdownStrip } from '../features/stats/StatusBreakdownStrip'
import { MissingDataStrip } from '../features/stats/MissingDataStrip'
import { DestinationProgressGrid } from '../features/stats/DestinationProgressGrid'
import { LoadingState } from '../components/LoadingState'
import { ErrorState } from '../components/ErrorState'
import {
  computeDestinationProgress,
  computeMissingDataCounts,
  computeOverallCompletion,
  computeStatusBreakdown,
  evaluateVenueQualities,
} from '../lib/dashboardAggregates'

/** EP18 — Dashboard Statistics, extended per docs/STUDIO_PRODUCT_GAP_AUDIT.md
 * §6 (Phase 1 items 1-2-4-5: top-line completion, status breakdown,
 * missing-data strip, per-destination progress). All new sections are
 * display-only this phase — no filtering, no navigation (see
 * `DashboardCard`'s `onClick`, deliberately unused here).
 *
 * The `GET /editor/stats` tiles below stay as-is (categories count etc.
 * aren't otherwise available without extra fetching); the new sections
 * derive entirely from the full venue/destination sets via the same
 * `evaluateVenueQuality` evaluator the venue list and editor already use —
 * one source of truth, no duplicated quality logic. */
export function Dashboard() {
  const { data: stats, isPending: isStatsPending, isError: isStatsError, error: statsError, refetch: refetchStats } =
    usePlatformStats()
  const { data: venues, isPending: isVenuesPending, isError: isVenuesError, error: venuesError, refetch: refetchVenues } =
    useAllVenues()
  const {
    data: destinations,
    isPending: isDestinationsPending,
    isError: isDestinationsError,
    error: destinationsError,
    refetch: refetchDestinations,
  } = useAllDestinations()

  // Evaluated once per venue, then shared by every aggregate below —
  // none of them re-run evaluateVenueQuality themselves.
  const qualityByVenueId = useMemo(() => (venues ? evaluateVenueQualities(venues) : null), [venues])

  const statusBreakdown = useMemo(() => (venues ? computeStatusBreakdown(venues) : null), [venues])
  const missingDataCounts = useMemo(
    () => (qualityByVenueId ? computeMissingDataCounts(qualityByVenueId) : null),
    [qualityByVenueId],
  )
  const overallCompletion = useMemo(
    () => (qualityByVenueId ? computeOverallCompletion(qualityByVenueId) : null),
    [qualityByVenueId],
  )
  const destinationProgress = useMemo(
    () =>
      venues && destinations && qualityByVenueId
        ? computeDestinationProgress(venues, destinations, qualityByVenueId)
        : null,
    [venues, destinations, qualityByVenueId],
  )

  if (isStatsPending || isVenuesPending || isDestinationsPending) {
    return <LoadingState label="Loading statistics…" />
  }

  if (isStatsError) {
    return (
      <ErrorState
        message={statsError instanceof Error ? statsError.message : 'Failed to load statistics.'}
        onRetry={() => refetchStats()}
      />
    )
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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">An overview of SahelSpot Platform's editorial content.</p>
      </div>

      {overallCompletion !== null && (
        <DashboardCard icon={Tag} label="Overall Completion" value={`${overallCompletion}%`} />
      )}

      {statusBreakdown && <StatusBreakdownStrip breakdown={statusBreakdown} />}

      {missingDataCounts && <MissingDataStrip counts={missingDataCounts} />}

      {destinationProgress && destinationProgress.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-gray-900">Destination Progress</h2>
          <DestinationProgressGrid rows={destinationProgress} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <StatTile icon={Store} label="Venues" value={String(stats.venues)} />
        <StatTile icon={MapPin} label="Destinations" value={String(stats.destinations)} />
        <StatTile icon={Tag} label="Categories" value={String(stats.categories)} />
        <StatTile icon={Camera} label="With Cover" value={`${stats.with_cover} (${stats.pct_cover.toFixed(1)}%)`} />
        <StatTile
          icon={AtSign}
          label="With Instagram"
          value={`${stats.with_instagram} (${stats.pct_instagram.toFixed(1)}%)`}
        />
        <StatTile icon={Globe} label="With Website" value={String(stats.with_website)} />
        <StatTile icon={Phone} label="With Phone" value={String(stats.with_phone)} />
      </div>
    </div>
  )
}
