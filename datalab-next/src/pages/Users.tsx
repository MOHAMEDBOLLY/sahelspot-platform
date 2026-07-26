import { UsersPanel } from '../features/users/UsersPanel'

/** User Role Management (Sprint 32) — same shape as `pages/Activity.tsx`:
 * one panel, no local page state. */
export function Users() {
  return (
    <div className="flex h-full flex-col gap-4">
      <UsersPanel />
    </div>
  )
}
