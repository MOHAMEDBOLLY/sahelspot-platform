"""Authorization — what an authenticated user is allowed to do.

Deliberately separate from `app/auth/dependencies.py`: that module answers
"who is this" (and, as of Sprint 24, "what role do they hold"); this
module answers "is that role enough for this specific action." No route
anywhere in this codebase ever depends on a role name — every route
depends on `require_permission(Permission.X)`, and the only place a role
is ever associated with a permission is the static `ROLE_PERMISSIONS` map
below. This means a future role split/merge/rename is a one-line change
here, never a change to any route.

`Permission` is a typed enum, not string literals, for the same reason
`venues.category`/`destinations.status` are CHECK-constrained columns
rather than free text: a small, closed, product-defined vocabulary is
worth validating everywhere it's used, and an enum gets that validation
at development time (typos fail before the code runs, refactors are a
symbol rename, not a project-wide string search) rather than only at
request time.

No database table backs this map — a runtime-editable permissions table
would be a policy engine, which Sprint 24 explicitly does not build (see
`docs/ROADMAP.md`'s Sprint 24 entry). The map is small, fixed, and
reviewed the same way `CONTENT_STATUSES`/`VENUE_CATEGORIES` already are:
by changing code and shipping a deploy, not by an admin screen.
"""

from enum import Enum

from fastapi import Depends, HTTPException, Request

from app.auth.dependencies import CurrentUser, get_current_user, log_auth_failure


class Permission(str, Enum):
    CONTENT_VIEW = "content_view"
    CONTENT_EDIT = "content_edit"
    CONTENT_SUBMIT_REVIEW = "content_submit_review"
    CONTENT_APPROVE = "content_approve"
    CONTENT_PUBLISH = "content_publish"
    USER_MANAGE_ROLES = "user_manage_roles"
    # Studio Operations dashboard (Phase 3, Sprint 1) — gates visibility of
    # the read-only `/operations` page only. Not required by any route yet:
    # every data source that page reads (`GET /`, `GET /health`,
    # `GET /editor/publish/revisions`) already has its own access rule.
    # Admin-only, same reasoning as `USER_MANAGE_ROLES` — infrastructure
    # visibility isn't something editors/publishers need for their job.
    SYSTEM_VIEW = "system_view"


# The only place a role name and a permission are ever associated with
# each other. Deliberately a strict hierarchy (each role's set is a
# superset of the one below it) since nothing in the product today needs
# a cross-cutting split (e.g. "can publish but not approve") — see the
# Sprint 24 ADR for why that's a documented future-split trigger, not
# something built speculatively now.
ROLE_PERMISSIONS: dict[str, frozenset[Permission]] = {
    "viewer": frozenset(
        {
            Permission.CONTENT_VIEW,
        }
    ),
    "editor": frozenset(
        {
            Permission.CONTENT_VIEW,
            Permission.CONTENT_EDIT,
            Permission.CONTENT_SUBMIT_REVIEW,
        }
    ),
    "publisher": frozenset(
        {
            Permission.CONTENT_VIEW,
            Permission.CONTENT_EDIT,
            Permission.CONTENT_SUBMIT_REVIEW,
            Permission.CONTENT_APPROVE,
            Permission.CONTENT_PUBLISH,
        }
    ),
    "admin": frozenset(
        {
            Permission.CONTENT_VIEW,
            Permission.CONTENT_EDIT,
            Permission.CONTENT_SUBMIT_REVIEW,
            Permission.CONTENT_APPROVE,
            Permission.CONTENT_PUBLISH,
            Permission.USER_MANAGE_ROLES,
            Permission.SYSTEM_VIEW,
        }
    ),
}


def require_permission(permission: Permission):
    """Returns a FastAPI dependency that raises `403` unless the caller's
    role grants `permission`. Composes with `get_current_user` (cached per
    request by FastAPI, so this never re-verifies the token) rather than
    duplicating identity resolution — the exact same "one shared guard,
    not one per call site" shape `app/workflow/transitions.py`'s
    `require_status()` already established for status transitions.
    """

    def _check(request: Request, user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        granted = ROLE_PERMISSIONS.get(user.role, frozenset())
        if permission not in granted:
            # Security hardening PR 5 — the caller is already authenticated
            # here (this only runs after `get_current_user` succeeds), so
            # logging their `user_id` is safe and useful; this is the one
            # failure path where a real identity is already known.
            log_auth_failure(
                request,
                event="permission_denied",
                reason=f"role '{user.role}' lacks required permission '{permission.value}'",
                user_id=user.id,
            )
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "missing_permission",
                    "required": permission.value,
                },
            )
        return user

    return _check
