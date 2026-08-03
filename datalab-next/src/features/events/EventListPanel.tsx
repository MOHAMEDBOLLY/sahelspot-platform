import { useEffect, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { useEvents } from './useEvents'
import { EventList } from './EventList'
import { EventBulkActionToolbar } from './EventBulkActionToolbar'
import { LoadingState } from '../../components/LoadingState'
import { ErrorState } from '../../components/ErrorState'
import { PagePlaceholder } from '../../components/PagePlaceholder'
import { Pagination } from '../../components/Pagination'
import type { EventSearchParams } from '../../types/event'

type EventListPanelProps = {
  selectedEventId: string | null
  onSelectEvent: (id: string) => void
  searchParams: EventSearchParams
  onPageChange: (page: number) => void
}

/** Events Module v1 — same shape as `VenueListPanel`: `searchParams`
 * owned by the parent page, checkbox selection for bulk actions owned
 * here, pruned whenever the loaded page changes. */
export function EventListPanel({ selectedEventId, onSelectEvent, searchParams, onPageChange }: EventListPanelProps) {
  const { data, isPending, isError, error, refetch } = useEvents(searchParams)
  const [checkedEventIds, setCheckedEventIds] = useState<Set<string>>(new Set())
  const hasActiveFilters = Boolean(searchParams.q || searchParams.status || searchParams.featured)

  useEffect(() => {
    if (!data) return
    const visibleIds = new Set(data.items.map((event) => event.id))
    setCheckedEventIds((current) => {
      const pruned = new Set([...current].filter((id) => visibleIds.has(id)))
      return pruned.size === current.size ? current : pruned
    })
  }, [data])

  function toggleChecked(id: string) {
    setCheckedEventIds((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function toggleSelectAll() {
    if (!data) return
    setCheckedEventIds((current) =>
      current.size === data.items.length ? new Set() : new Set(data.items.map((event) => event.id)),
    )
  }

  if (isPending) {
    return <LoadingState label="Loading events…" />
  }

  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'Failed to load events.'}
        onRetry={() => refetch()}
      />
    )
  }

  if (!data || data.items.length === 0) {
    return hasActiveFilters ? (
      <PagePlaceholder icon={CalendarDays} title="No matching events" description="Try a different search term or clearing a filter." />
    ) : (
      <PagePlaceholder icon={CalendarDays} title="No events yet" description="Events will appear here once they're added." />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {checkedEventIds.size > 0 && (
        <EventBulkActionToolbar
          checkedEvents={data.items.filter((event) => checkedEventIds.has(event.id))}
          onClearSelection={() => setCheckedEventIds(new Set())}
        />
      )}
      <label className="flex min-h-11 items-center gap-2 px-1 text-xs font-medium text-gray-500 lg:min-h-0">
        <input
          type="checkbox"
          checked={checkedEventIds.size > 0 && checkedEventIds.size === data.items.length}
          onChange={toggleSelectAll}
          className="h-4 w-4 rounded border-gray-300"
        />
        Select all on this page ({data.items.length})
      </label>
      <EventList
        events={data.items}
        selectedEventId={selectedEventId}
        onSelectEvent={onSelectEvent}
        checkedEventIds={checkedEventIds}
        onToggleChecked={toggleChecked}
      />
      <Pagination
        page={data.page}
        pageSize={data.page_size}
        total={data.total}
        onPageChange={onPageChange}
        itemLabel="events"
      />
    </div>
  )
}
