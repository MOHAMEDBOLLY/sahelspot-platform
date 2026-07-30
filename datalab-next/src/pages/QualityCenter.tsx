import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Gauge, Layers, TrendingDown } from 'lucide-react'
import { useAllVenues } from '../features/stats/useAllVenues'
import { useAllDestinations } from '../features/stats/useAllDestinations'
import { DashboardCard } from '../components/DashboardCard'
import { StatusBreakdownStrip } from '../features/stats/StatusBreakdownStrip'
import { MissingDataStrip } from '../features/stats/MissingDataStrip'
import { DestinationProgressGrid } from '../features/stats/DestinationProgressGrid'
import { CompletionDistribution } from '../features/quality/CompletionDistribution'
import { ActionQueueList } from '../features/quality/ActionQueueList'
import { LoadingState } from '../components/LoadingState'
import { ErrorState } from '../components/ErrorState'
import {
  computeActionQueue,
  computeCompletionDistribution,
  computeCompletionSummary,
  computeDestinationProgress,
  computeMissingDataCounts,
  computeOverallCompletion,
  computeStatusBreakdown,
  evaluateVenueQualities,
} from '../lib/dashboardAggregates'
import type { VenueStatus } from '../types/venue'
import type { QualityField } from '../lib/qualityFieldRegistry'

/** Phase 2 — Data Quality Center. An operational worklist, not a second
 * dashboard: every section here reuses the same data source
 * (`useAllVenues`/`useAllDestinations`), the same single-pass evaluation
 * (`evaluateVenueQualities`), and the same aggregate functions the
 * Dashboard already uses — the only things unique to this page are the
 * completion-distribution and action-queue aggregates (both pure
 * functions over the same `VenueQuality` map, added alongside the
 * existing ones in `lib/dashboardAggregates.ts`) and the drill-down
 * navigation, which reuses the Venue List's existing filters plus the new
 * `missing`/`maxCompletion` params `useVenueSearch` understands. */
export function QualityCenter() {
  const navigate = useNavigate()
  const { data: venues, isPending: isVenuesPending, isError: isVenuesError, error: venuesError, refetch: refetchVenues } =
    useAllVenues()
  const {
    data: destinations,
    isPending: isDestinationsPending,
    isError: isDestinationsError,
    error: destinationsError,
    refetch: refetchDestinations,
  } = useAllDestinations()

  const qualityByVenueId = useMemo(() => (venues ? evaluateVenueQualities(venues) : null), [venues])

  const statusBreakdown = useMemo(() => (venues ? computeStatusBreakdown(venues) : null), [venues])
  const completionSummary = useMemo(
    () => (qualityByVenueId ? computeCompletionSummary(qualityByVenueId) : null),
    [qualityByVenueId],
  )
  const overallCompletion = useMemo(
    () => (qualityByVenueId ? computeOverallCompletion(qualityByVenueId) : null),
    [qualityByVenueId],
  )
  const missingDataCounts = useMemo(
    () => (qualityByVenueId ? computeMissingDataCounts(qualityByVenueId) : null),
    [qualityByVenueId],
  )
  const distribution = useMemo(
    () => (qualityByVenueId ? computeCompletionDistribution(qualityByVenueId) : null),
    [qualityByVenueId],
  )
  const actionQueue = useMemo(
    () => (qualityByVenueId ? computeActionQueue(qualityByVenueId) : null),
    [qualityByVenueId],
  )
  const destinationProgress = useMemo(() => {
    if (!venues || !destinations || !qualityByVenueId) return null
    // Worst quality first — the one Destination Health requirement not
    // already true of the Dashboard's (alphabetical) ordering.
    return computeDestinationProgress(venues, destinations, qualityByVenueId).sort(
      (a, b) => a.averageCompletionPercent - b.averageCompletionPercent,
    )
  }, [venues, destinations, qualityByVenueId])

  function goToStatus(status: VenueStatus) {
    navigate(`/venues?status=${encodeURIComponent(status)}`)
  }

  function goToMissingField(field: QualityField) {
    navigate(`/venues?missing=${encodeURIComponent(field)}`)
  }

  if (isVenuesPending || isDestinationsPending) {
    return <LoadingState label="Loading data quality…" />
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
        <h1 className="text-lg font-semibold text-gray-900">Data Quality Center</h1>
        <p className="text-sm text-gray-500">
          What's missing, where it's missing, and what to fix first — across every venue.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-gray-900">Overview</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {overallCompletion !== null && (
            <DashboardCard icon={Gauge} label="Average Completion" value={`${overallCompletion}%`} />
          )}
          {completionSummary && (
            <DashboardCard icon={CheckCircle2} label="Complete" value={String(completionSummary.complete)} />
          )}
          {completionSummary && (
            <DashboardCard
              icon={TrendingDown}
              label="Needs Attention"
              value={String(completionSummary.needsAttention)}
              onClick={() => navigate('/venues?maxCompletion=100')}
            />
          )}
          {statusBreakdown && (
            <DashboardCard icon={Layers} label="Total Venues" value={String(statusBreakdown.total)} />
          )}
        </div>
        {statusBreakdown && <StatusBreakdownStrip breakdown={statusBreakdown} onStatusClick={goToStatus} />}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-gray-900">Missing Data</h2>
        {missingDataCounts && statusBreakdown && (
          <MissingDataStrip counts={missingDataCounts} total={statusBreakdown.total} onFieldClick={goToMissingField} />
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-gray-900">Completion Distribution</h2>
        {distribution && <CompletionDistribution buckets={distribution} />}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-gray-900">Destination Health</h2>
        <p className="text-xs text-gray-500">Sorted worst average completion first.</p>
        {destinationProgress && destinationProgress.length > 0 && (
          <DestinationProgressGrid
            rows={destinationProgress}
            linkTo={(row) => `/venues?destination=${encodeURIComponent(row.destinationId)}`}
          />
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-gray-900">Action Queue</h2>
        {actionQueue && <ActionQueueList groups={actionQueue} />}
      </section>
    </div>
  )
}
