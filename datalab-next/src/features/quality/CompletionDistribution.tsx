import type { CompletionBucket } from '../../lib/dashboardAggregates'

type CompletionDistributionProps = {
  buckets: CompletionBucket[]
}

/** One row per attainable score (see `computeCompletionDistribution`'s
 * docstring for why this isn't generic 10%-wide buckets) — bucket shape is
 * deliberately the only thing that would need to change if the quality
 * model ever grows more granular; this component just renders whatever
 * buckets it's given. */
export function CompletionDistribution({ buckets }: CompletionDistributionProps) {
  return (
    <div className="flex flex-col divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
      {buckets.map((bucket) => (
        <div key={bucket.score} className="flex flex-col gap-1.5 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-gray-900">{bucket.percent}% complete</span>
            <span className="shrink-0 text-xs text-gray-500">
              {bucket.count} venue{bucket.count === 1 ? '' : 's'} ({bucket.percentageOfDataset}%)
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-sky-500"
              style={{ width: `${bucket.percentageOfDataset}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
