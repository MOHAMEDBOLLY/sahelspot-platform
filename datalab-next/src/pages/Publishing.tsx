import { useState } from 'react'
import { RevisionListPanel } from '../features/publishing/RevisionListPanel'
import { RevisionDetail } from '../features/publishing/RevisionDetail'

/** Revision Browser (Sprint 17) — read-only inspection of publish history.
 * No publish/rollback controls live here yet; this page only lets an
 * editor see what's been published and when. */
export function Publishing() {
  const [selectedRevisionId, setSelectedRevisionId] = useState<number | null>(null)

  return (
    <div className="flex h-full gap-6">
      <div className="w-80 shrink-0 overflow-y-auto">
        <RevisionListPanel selectedRevisionId={selectedRevisionId} onSelectRevision={setSelectedRevisionId} />
      </div>
      <div className="min-w-0 flex-1 overflow-y-auto">
        <RevisionDetail revisionId={selectedRevisionId} />
      </div>
    </div>
  )
}
