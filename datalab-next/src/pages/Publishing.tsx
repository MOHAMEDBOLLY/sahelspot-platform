import { useState } from 'react'
import { RevisionListPanel } from '../features/publishing/RevisionListPanel'
import { RevisionDetail } from '../features/publishing/RevisionDetail'
import { PublishButton } from '../features/publishing/PublishButton'
import { useAuth } from '../features/auth/useAuth'
import { hasPermission } from '../features/auth/permissions'
import type { PublishRevisionSummary } from '../features/publishing/types'

/** Revision Browser (Sprint 17), with Publish added in EP17-T01 — the
 * Republish control already lives on `RevisionDetail`. */
export function Publishing() {
  const [selectedRevisionId, setSelectedRevisionId] = useState<number | null>(null)
  const [lastPublished, setLastPublished] = useState<PublishRevisionSummary | null>(null)
  const { role } = useAuth()
  const canPublish = hasPermission(role, 'content_publish')

  function handlePublished(revision: PublishRevisionSummary) {
    setLastPublished(revision)
    setSelectedRevisionId(revision.id)
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Publishing</h1>
          {lastPublished && lastPublished.excluded_venue_count > 0 && (
            <p className="text-sm text-amber-600">
              Published with {lastPublished.excluded_venue_count} venue
              {lastPublished.excluded_venue_count === 1 ? '' : 's'} excluded (destination not approved).
            </p>
          )}
        </div>
        {canPublish && <PublishButton onPublished={handlePublished} />}
      </div>

      <div className="flex min-h-0 flex-1 gap-6">
        <div className="w-80 shrink-0 overflow-y-auto">
          <RevisionListPanel selectedRevisionId={selectedRevisionId} onSelectRevision={setSelectedRevisionId} />
        </div>
        <div className="min-w-0 flex-1 overflow-y-auto">
          <RevisionDetail revisionId={selectedRevisionId} />
        </div>
      </div>
    </div>
  )
}
