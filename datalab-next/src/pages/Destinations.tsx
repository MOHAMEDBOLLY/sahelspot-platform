import { useState } from 'react'
import { DestinationListPanel } from '../features/destinations/DestinationListPanel'
import { DestinationWorkspace } from '../features/destinations/workspace/DestinationWorkspace'

/** Destination Workspace (Sprint 21) — same two-panel list/detail shape as
 * `Venues.tsx`, including the same dirty-check confirmation before
 * switching destinations mid-edit. */
export function Destinations() {
  const [selectedDestinationId, setSelectedDestinationId] = useState<string | null>(null)
  const [isWorkspaceDirty, setIsWorkspaceDirty] = useState(false)

  function handleSelectDestination(id: string) {
    if (isWorkspaceDirty) {
      const confirmed = window.confirm(
        'You have unsaved changes in this destination. Discard them and switch destinations?',
      )
      if (!confirmed) return
    }
    setSelectedDestinationId(id)
  }

  return (
    <div className="flex h-full gap-6">
      <div className="w-80 shrink-0 overflow-y-auto">
        <DestinationListPanel
          selectedDestinationId={selectedDestinationId}
          onSelectDestination={handleSelectDestination}
        />
      </div>
      <div className="min-w-0 flex-1 overflow-y-auto">
        <DestinationWorkspace destinationId={selectedDestinationId} onDirtyChange={setIsWorkspaceDirty} />
      </div>
    </div>
  )
}
