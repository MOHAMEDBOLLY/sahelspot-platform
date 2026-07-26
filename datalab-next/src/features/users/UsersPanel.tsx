import { Users as UsersIcon } from 'lucide-react'
import { useUsers } from './useUsers'
import { UsersTable } from './UsersTable'
import { LoadingState } from '../../components/LoadingState'
import { ErrorState } from '../../components/ErrorState'
import { PagePlaceholder } from '../../components/PagePlaceholder'

/** Sprint 32 — same loading/error/empty shape `ActivityPanel` already
 * uses. A `viewer` (or any role without `user_manage_roles`) hitting this
 * gets the query's own `403` surfaced here as the standard "You don't have
 * permission..." `ErrorState` message — no separate page-level guard, the
 * same backend-enforces/frontend-just-renders split every other permission
 * check in this app already follows. */
export function UsersPanel() {
  const { data, isPending, isError, error, refetch } = useUsers()

  if (isPending) {
    return <LoadingState label="Loading users…" />
  }

  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'Failed to load users.'}
        onRetry={() => refetch()}
      />
    )
  }

  if (!data || data.length === 0) {
    return <PagePlaceholder icon={UsersIcon} title="No users yet" description="Users appear here after first login." />
  }

  return <UsersTable users={data} />
}
