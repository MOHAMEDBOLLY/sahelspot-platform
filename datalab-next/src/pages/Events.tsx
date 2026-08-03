import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { EventListPanel } from '../features/events/EventListPanel'
import { EventFilters } from '../features/events/EventFilters'
import { EventCreateDialog } from '../features/events/EventCreateDialog'
import { EventWorkspace } from '../features/events/workspace/EventWorkspace'
import { useAuth } from '../features/auth/useAuth'
import { hasPermission } from '../features/auth/permissions'
import { useDebouncedValue } from '../hooks/useDebouncedValue'

/** Events Module v1 — same two-panel list/detail shell every other
 * entity's page already uses (`Venues.tsx`/`Destinations.tsx`), same
 * URL-synced search/filter split (`useSearchParams`, not local state) and
 * same dirty-check-before-switching confirmation. */
export function Events() {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [isWorkspaceDirty, setIsWorkspaceDirty] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const { role } = useAuth()
  const canCreate = hasPermission(role, 'content_edit')

  const q = searchParams.get('q') ?? ''
  const status = searchParams.get('status') ?? ''
  const featured = searchParams.get('featured') === 'true'
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1)
  const debouncedQ = useDebouncedValue(q, 300)

  function setParam(key: string, value: string) {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        if (value) {
          next.set(key, value)
        } else {
          next.delete(key)
        }
        next.delete('page')
        return next
      },
      { replace: true },
    )
  }

  function setPage(nextPage: number) {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        if (nextPage <= 1) {
          next.delete('page')
        } else {
          next.set('page', String(nextPage))
        }
        return next
      },
      { replace: true },
    )
  }

  function handleSelectEvent(id: string) {
    if (isWorkspaceDirty) {
      const confirmed = window.confirm('You have unsaved changes in this event. Discard them and switch events?')
      if (!confirmed) return
    }
    setSelectedEventId(id)
  }

  function handleDeleted() {
    setSelectedEventId(null)
  }

  return (
    <div className="flex h-full min-h-0 gap-6">
      <div className="flex min-h-0 w-80 shrink-0 flex-col gap-3 overflow-y-auto">
        {canCreate && <EventCreateDialog onCreated={(event) => setSelectedEventId(event.id)} />}
        <EventFilters
          searchValue={q}
          onSearchChange={(value) => setParam('q', value)}
          status={status}
          onStatusChange={(value) => setParam('status', value)}
          featuredOnly={featured}
          onFeaturedOnlyChange={(value) => setParam('featured', value ? 'true' : '')}
        />
        <EventListPanel
          selectedEventId={selectedEventId}
          onSelectEvent={handleSelectEvent}
          searchParams={{
            q: debouncedQ || undefined,
            status: status || undefined,
            featured: featured || undefined,
            page,
          }}
          onPageChange={setPage}
        />
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <EventWorkspace eventId={selectedEventId} onDirtyChange={setIsWorkspaceDirty} onDeleted={handleDeleted} />
      </div>
    </div>
  )
}
