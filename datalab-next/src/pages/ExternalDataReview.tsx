import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Database, ChevronRight } from 'lucide-react'
import { fetchExternalRecords, type ExternalRecordFilters } from '../features/externalData/api'
import { LoadDatasetDialog } from '../features/externalData/LoadDatasetDialog'
import { ExternalRecordDetail } from '../features/externalData/ExternalRecordDetail'
import { LoadingState } from '../components/LoadingState'
import { ErrorState } from '../components/ErrorState'

/** External Data Enrichment Workflow (Phase 1). External Research ->
 * Match -> Human Review -> Field-level Approval -> Apply — never a
 * blind CSV/JSON import into `venues`. List + detail within one page
 * via local selection state, same established pattern `pages/Events.tsx`
 * /`pages/NoQr.tsx` already use. */
export function ExternalDataReview() {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [filters, setFilters] = useState<ExternalRecordFilters>({})

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['external-records', filters],
    queryFn: () => fetchExternalRecords(filters),
  })

  const sources = useMemo(() => {
    const set = new Set<string>()
    data?.items.forEach((r) => set.add(r.source))
    return Array.from(set).sort()
  }, [data])

  if (selectedId !== null) {
    return <ExternalRecordDetail recordId={selectedId} onBack={() => setSelectedId(null)} />
  }

  if (isPending) return <LoadingState label="Loading external data review…" />
  if (isError) {
    return (
      <ErrorState message={error instanceof Error ? error.message : 'Failed to load external records.'} onRetry={refetch} />
    )
  }

  const s = data.summary

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
            <Database size={22} className="text-gray-500" />
            External Data Review
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Review external research records, resolve matches, and selectively apply approved fields to Studio
            venues.
          </p>
        </div>
        <LoadDatasetDialog />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <Counter label="Total" value={s.total} />
        <Counter label="Matched" value={s.by_match_status.MATCH_CONFIRMED ?? 0} />
        <Counter label="Probable" value={s.by_match_status.MATCH_PROBABLE ?? 0} />
        <Counter label="Needs Review" value={s.by_match_status.REVIEW_REQUIRED ?? 0} />
        <Counter label="No Match" value={s.by_match_status.NO_MATCH ?? 0} />
        <Counter label="Approved" value={s.by_review_status.APPROVED ?? 0} />
        <Counter label="Partially Applied" value={s.by_review_status.PARTIALLY_APPLIED ?? 0} />
        <Counter label="Rejected" value={s.by_review_status.REJECTED ?? 0} />
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterSelect
          label="Source"
          value={filters.source ?? ''}
          options={sources}
          onChange={(v) => setFilters((f) => ({ ...f, source: v || undefined }))}
        />
        <FilterSelect
          label="Match"
          value={filters.match_status ?? ''}
          options={['MATCH_CONFIRMED', 'MATCH_PROBABLE', 'REVIEW_REQUIRED', 'NO_MATCH']}
          onChange={(v) => setFilters((f) => ({ ...f, match_status: v || undefined }))}
        />
        <FilterSelect
          label="Review"
          value={filters.review_status ?? ''}
          options={['PENDING', 'IN_REVIEW', 'APPROVED', 'PARTIALLY_APPLIED', 'REJECTED', 'NEEDS_RESEARCH']}
          onChange={(v) => setFilters((f) => ({ ...f, review_status: v || undefined }))}
        />
      </div>

      {data.items.length === 0 ? (
        <p className="text-sm text-gray-400">No external records match these filters.</p>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white">
          <ul className="divide-y divide-gray-100">
            {data.items.map((record) => (
              <li key={record.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(record.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {record.source}: {record.external_name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {record.external_destination || '—'} · {record.external_category || '—'}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    {record.match_status}
                  </span>
                  <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    {record.review_status}
                  </span>
                  <ChevronRight size={14} className="shrink-0 text-gray-300" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-lg font-semibold text-gray-900">{value}</p>
    </div>
  )
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-gray-500">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-9 rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-900"
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}
