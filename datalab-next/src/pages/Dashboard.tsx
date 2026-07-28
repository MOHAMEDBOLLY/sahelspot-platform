import { AtSign, Camera, Globe, MapPin, Phone, Store, Tag } from 'lucide-react'
import { usePlatformStats } from '../features/stats/usePlatformStats'
import { StatTile } from '../features/stats/StatTile'
import { LoadingState } from '../components/LoadingState'
import { ErrorState } from '../components/ErrorState'

/** EP18 — Dashboard Statistics. Replaces the placeholder with live tiles
 * from `GET /editor/stats` (PLATFORM_SPEC_v1.0_FROZEN.md §2.9). */
export function Dashboard() {
  const { data: stats, isPending, isError, error, refetch } = usePlatformStats()

  if (isPending) {
    return <LoadingState label="Loading statistics…" />
  }

  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'Failed to load statistics.'}
        onRetry={() => refetch()}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">An overview of SahelSpot Platform's editorial content.</p>
      </div>

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
