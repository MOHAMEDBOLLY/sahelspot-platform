/** Sprint 24 — a UX-only mirror of the backend's role -> permission map
 * (`api/app/auth/permissions.py`). Used only to decide what to render —
 * every one of these checks is re-enforced server-side by
 * `require_permission(...)`, and the backend never trusts that the
 * frontend hid anything. Kept as a typed union, not free-form strings,
 * for the same reason the backend uses an enum: a typo here should fail
 * at the type-checker, not silently show a button that always 403s.
 */
export type Permission =
  | 'content_view'
  | 'content_edit'
  | 'content_submit_review'
  | 'content_approve'
  | 'content_publish'
  | 'user_manage_roles'
  | 'system_view'

const ROLE_PERMISSIONS: Record<string, ReadonlySet<Permission>> = {
  viewer: new Set<Permission>(['content_view']),
  editor: new Set<Permission>(['content_view', 'content_edit', 'content_submit_review']),
  publisher: new Set<Permission>([
    'content_view',
    'content_edit',
    'content_submit_review',
    'content_approve',
    'content_publish',
  ]),
  admin: new Set<Permission>([
    'content_view',
    'content_edit',
    'content_submit_review',
    'content_approve',
    'content_publish',
    'user_manage_roles',
    'system_view',
  ]),
}

/** `role` is `null` while the session/role is still loading — treated as
 * "no permissions yet" rather than throwing, so a component can just call
 * this unconditionally during the loading window. */
export function hasPermission(role: string | null, permission: Permission): boolean {
  if (role === null) return false
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false
}
