import { apiGet, apiPatch } from '../../lib/apiClient'
import type { AppUser } from '../../types/user'

/** Sprint 32 — User Role Management. Both routes require
 * `user_manage_roles` server-side (see `api/app/api/routes/users.py`);
 * this file is a plain, unpaginated list — same shape `fetchDestinations`/
 * `fetchVenues` had before Sprint 27 introduced search/pagination, which
 * this feature doesn't need. */
export function fetchUsers(): Promise<AppUser[]> {
  return apiGet<AppUser[]>('/editor/users')
}

export function updateUserRole(userId: string, role: string): Promise<AppUser> {
  return apiPatch<AppUser>(`/editor/users/${encodeURIComponent(userId)}/role`, { role })
}
