import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DestinationListPanel } from '../features/destinations/DestinationListPanel'
import { DestinationFilters } from '../features/destinations/DestinationFilters'
import { DestinationCreateDialog } from '../features/destinations/DestinationCreateDialog'
import { DestinationWorkspace } from '../features/destinations/workspace/DestinationWorkspace'
import { useAuth } from '../features/auth/useAuth'
import { hasPermission } from '../features/auth/permissions'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { ExportButton } from '../components/ExportButton'
import { exportDestinations } from '../features/destinations/api'

/** Destination Workspace (Sprint 21) — same two-panel list/detail shape as
 * `Venues.tsx`, including the same dirty-check confirmation before
 * switching destinations mid-edit. Sprint 29 adds URL-synced search (same
 * split `Venues.tsx` already uses: state lives in `useSearchParams`, not
 * local state, so a refresh preserves it) and a create dialog, gated by
 * the same `content_edit` permission Save Draft already requires — no new
 * permission, reusing `hasPermission` rather than a second check. */
export function Destinations() {
  const [selectedDestinationId, setSelectedDestinationId] = useState<string | null>(null)
  const [isWorkspaceDirty, setIsWorkspaceDirty] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const { role } = useAuth()
  const canCreate = hasPermission(role, 'content_edit')

  const q = searchParams.get('q') ?? ''
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
        return next
      },
      { replace: true },
    )
  }

  function handleSelectDestination(id: string) {
    if (isWorkspaceDirty) {
      const confirmed = window.confirm(
        'You have unsaved changes in this destination. Discard them and switch destinations?',
      )
      if (!confirmed) return
    }
    setSelectedDestinationId(id)
  }

  function handleDeleted() {
    setSelectedDestinationId(null)
  }

  return (
    <div className="flex h-full gap-6">
      <div className="flex w-80 shrink-0 flex-col gap-3 overflow-y-auto">
        <DestinationFilters searchValue={q} onSearchChange={(value) => setParam('q', value)} />
        {canCreate && (
          <DestinationCreateDialog onCreated={(destination) => setSelectedDestinationId(destination.id)} />
        )}
        <ExportButton label="Export destinations" onExport={exportDestinations} />
        <DestinationListPanel
          selectedDestinationId={selectedDestinationId}
          onSelectDestination={handleSelectDestination}
          searchParams={{ q: debouncedQ || undefined }}
        />
      </div>
      <div className="min-w-0 flex-1 overflow-y-auto">
        <DestinationWorkspace
          destinationId={selectedDestinationId}
          onDirtyChange={setIsWorkspaceDirty}
          onDeleted={handleDeleted}
        />
      </div>
    </div>
  )
}
