import { useMemo } from 'react'
import { useVenues } from './useVenues'
import { useAllVenues } from '../stats/useAllVenues'
import { evaluateVenueQualities } from '../../lib/dashboardAggregates'
import { hasQualityFilter, matchesQualityFilter } from '../../lib/venueQualityFilter'
import type { Venue, VenueListResponse, VenueSearchParams } from '../../types/venue'

const DEFAULT_PAGE_SIZE = 50

/** Mirrors `GET /editor/venues`'s own filter semantics exactly (see
 * `api/app/api/routes/venues.py::list_venues`) — case-insensitive
 * substring on name, exact match on the rest, AND combined. Only used on
 * the client-side path below, where a quality filter (which the backend
 * can't express) must be combined with the ordinary filters in one pass
 * over the full dataset. Not a duplicate of existing frontend logic —
 * these filters were previously only ever sent to the backend, never
 * evaluated client-side. */
function matchesBaseFilters(venue: Venue, params: VenueSearchParams): boolean {
  if (params.q && !venue.name.toLowerCase().includes(params.q.toLowerCase())) return false
  if (params.destinationId && venue.destination.id !== params.destinationId) return false
  if (params.category && venue.category !== params.category) return false
  if (params.status && venue.status !== params.status) return false
  return true
}

export interface VenueSearchResult {
  data: VenueListResponse | undefined
  isPending: boolean
  isError: boolean
  error: unknown
  refetch: () => void
}

/**
 * The single data-access abstraction the Venue List goes through. Callers
 * (`VenueListPanel`) never know or care whether a given search resolved via
 * the server-paginated `GET /editor/venues` or a client-side filter pass —
 * both return the same `VenueListResponse` shape.
 *
 * Today: only `params.qualityFilter` (Advanced Filters — has/missing
 * fields, min/max completion, missing-field count, digital presence;
 * concepts the backend has no query params for) triggers the client-side
 * path. Every other search (the overwhelming majority of Venue List usage)
 * keeps using the existing server-paginated `useVenues` completely
 * unchanged — same network request, same cache key, same behavior as
 * before this feature existed.
 *
 * If the backend ever grows real quality-filter query params, only this
 * function's body needs to change (swap the client branch for another
 * server call) — `VenueListPanel`, `VenueList`, `Pagination`, and the
 * URL/routing layer in `pages/Venues.tsx` would need no changes at all.
 */
export function useVenueSearch(params: VenueSearchParams): VenueSearchResult {
  const { q, destinationId, category, status, page, pageSize, qualityFilter } = params
  const useClientPath = hasQualityFilter(qualityFilter ?? {})

  // Both hooks are always called (Rules of Hooks) — `enabled` decides
  // which one actually fetches. React Query no-ops the disabled one.
  const serverQuery = useVenues(params, { enabled: !useClientPath })
  const allVenuesQuery = useAllVenues({ enabled: useClientPath })

  const clientFiltered = useMemo<VenueListResponse | undefined>(() => {
    if (!useClientPath || !allVenuesQuery.data) return undefined

    const qualityByVenueId = evaluateVenueQualities(allVenuesQuery.data)
    const matched = allVenuesQuery.data
      .filter((venue) => matchesBaseFilters(venue, params))
      .filter((venue) => {
        const quality = qualityByVenueId.get(venue.id)
        return quality !== undefined && matchesQualityFilter(quality, qualityFilter ?? {})
      })
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))

    const effectivePage = page ?? 1
    const effectivePageSize = pageSize ?? DEFAULT_PAGE_SIZE
    const start = (effectivePage - 1) * effectivePageSize
    const items = matched.slice(start, start + effectivePageSize)

    return { items, total: matched.length, page: effectivePage, page_size: effectivePageSize }
    // Depend on primitive filter values, not `params`'s object identity —
    // a fresh literal every render from Venues.tsx would otherwise
    // invalidate this memo every render regardless of whether anything
    // actually changed.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [
    useClientPath,
    allVenuesQuery.data,
    q,
    destinationId,
    category,
    status,
    page,
    pageSize,
    qualityFilter?.has,
    qualityFilter?.missing,
    qualityFilter?.minCompletion,
    qualityFilter?.maxCompletion,
    qualityFilter?.missingCount,
    qualityFilter?.digitalPresence,
  ])

  if (useClientPath) {
    return {
      data: clientFiltered,
      isPending: allVenuesQuery.isPending,
      isError: allVenuesQuery.isError,
      error: allVenuesQuery.error,
      refetch: allVenuesQuery.refetch,
    }
  }

  return {
    data: serverQuery.data,
    isPending: serverQuery.isPending,
    isError: serverQuery.isError,
    error: serverQuery.error,
    refetch: serverQuery.refetch,
  }
}
