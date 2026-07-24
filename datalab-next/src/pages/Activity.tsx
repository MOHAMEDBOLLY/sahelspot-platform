import { ActivityPanel } from '../features/activity/ActivityPanel'

/** Editorial Activity Log (Sprint 19) — read-only, newest first, no
 * filtering yet. Purely observability: this page has no action of any
 * kind, it only displays what workflow/publishing actions already did. */
export function Activity() {
  return (
    <div className="flex h-full flex-col gap-4">
      <ActivityPanel />
    </div>
  )
}
