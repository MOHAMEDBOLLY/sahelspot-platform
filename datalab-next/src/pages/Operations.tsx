import { ShieldAlert } from 'lucide-react'
import { useAuth } from '../features/auth/useAuth'
import { hasPermission } from '../features/auth/permissions'
import { PagePlaceholder } from '../components/PagePlaceholder'
import { SystemInformationCard } from '../features/ops/SystemInformationCard'
import { ApiHealthCard } from '../features/ops/ApiHealthCard'
import { PublishingSummaryCard } from '../features/ops/PublishingSummaryCard'

/** Studio Production Operations dashboard (Phase 3, Sprint 1 — foundation
 * only). Strictly read-only: every card either displays information or
 * navigates to the existing module that owns it (Publishing Summary →
 * `/publishing`) — see `docs/STUDIO_OPERATIONS_DASHBOARD.md`'s Dashboard
 * Philosophy and Read-Only Rule, both permanent architectural decisions.
 * Gated by `Permission.SYSTEM_VIEW` (admin-only) — checked here, the same
 * inline pattern `pages/Publishing.tsx` already uses for its own
 * permission-gated control, not a new routing-guard component. */
export function Operations() {
  const { role } = useAuth()
  const canView = hasPermission(role, 'system_view')

  if (!canView) {
    return (
      <PagePlaceholder
        icon={ShieldAlert}
        title="Not authorized"
        description="The Operations dashboard is available to admins only."
      />
    )
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Operations</h1>
        <p className="text-sm text-gray-500">Read-only platform overview.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SystemInformationCard />
        <ApiHealthCard />
        <PublishingSummaryCard />
      </div>
    </div>
  )
}
