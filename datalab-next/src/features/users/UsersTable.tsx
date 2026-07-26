import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { hasPermission } from '../auth/permissions'
import { useUpdateUserRole } from './useUpdateUserRole'
import { APP_USER_ROLES } from './appUserRoles'
import { ApiError } from '../../lib/apiClient'
import { formatDateTime } from '../../lib/formatDate'
import type { AppUser } from '../../types/user'

type UsersTableProps = {
  users: AppUser[]
}

/** Sprint 32 — one row per user, each with its own `useUpdateUserRole()`
 * instance so a save in one row never affects another row's loading/error/
 * success state — same reasoning `DestinationWorkspace` already has for
 * calling a mutation hook more than once in the same component. */
function UserRow({ user }: { user: AppUser }) {
  const { role: viewerRole } = useAuth()
  const canManageRoles = hasPermission(viewerRole, 'user_manage_roles')
  const [selectedRole, setSelectedRole] = useState(user.role)
  const [showSaved, setShowSaved] = useState(false)
  const { mutate: saveRole, isPending, error, reset } = useUpdateUserRole()

  const isDirty = selectedRole !== user.role

  function handleSave() {
    setShowSaved(false)
    saveRole(
      { userId: user.id, role: selectedRole },
      { onSuccess: () => setShowSaved(true) },
    )
  }

  return (
    <tr>
      <td className="px-4 py-2 text-gray-700">{user.email ?? <span className="text-gray-400 italic">—</span>}</td>
      <td className="px-4 py-2">
        {canManageRoles ? (
          <select
            value={selectedRole}
            onChange={(event) => {
              setShowSaved(false)
              reset()
              setSelectedRole(event.target.value)
            }}
            className="rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-900"
          >
            {APP_USER_ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        ) : (
          <span className="font-medium text-gray-900">{user.role}</span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-2 text-gray-500">{formatDateTime(user.created_at)}</td>
      <td className="px-4 py-2">
        {canManageRoles && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={!isDirty || isPending}
              className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? <Loader2 size={12} className="animate-spin" /> : null}
              {isPending ? 'Saving…' : 'Save'}
            </button>
            {showSaved && !isPending && (
              <span className="flex items-center gap-1 text-xs font-medium text-green-700">
                <Check size={12} />
                Saved
              </span>
            )}
            {error && (
              <span
                className="truncate text-xs font-medium text-red-600"
                title={error instanceof ApiError ? error.message : 'Failed to update role.'}
              >
                {error instanceof ApiError ? error.message : 'Failed to update role.'}
              </span>
            )}
          </div>
        )}
      </td>
    </tr>
  )
}

export function UsersTable({ users }: UsersTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-200 bg-gray-50">
          <tr>
            <th className="px-4 py-2 font-medium text-gray-500">Email</th>
            <th className="px-4 py-2 font-medium text-gray-500">Role</th>
            <th className="px-4 py-2 font-medium text-gray-500">Created</th>
            <th className="px-4 py-2 font-medium text-gray-500">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {users.map((user) => (
            <UserRow key={user.id} user={user} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
