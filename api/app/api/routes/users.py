from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.activity.service import log_activity
from app.api.schemas import UserOut, UserRoleUpdate
from app.auth.dependencies import CurrentUser, get_current_user
from app.auth.permissions import Permission, require_permission
from app.db.models import APP_USER_ROLES, AppUser
from app.db.session import get_db

# Sprint 32 — User Role Management, the last gap `docs/ROADMAP.md`'s
# Sprint 24 entry already named: `Permission.USER_MANAGE_ROLES` existed
# from the start, with nothing that required it until now. Both routes
# below require it — listing every user's email/role is management data,
# not general editorial content, so it gets the same gate as changing one.
router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_permission(Permission.USER_MANAGE_ROLES)),
):
    return db.query(AppUser).order_by(AppUser.created_at).all()


@router.patch("/{user_id}/role", response_model=UserOut)
def update_user_role(
    user_id: str,
    payload: UserRoleUpdate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    _: CurrentUser = Depends(require_permission(Permission.USER_MANAGE_ROLES)),
):
    """Sprint 32 — the one write path `_provision_viewer` (Sprint 24)
    already deferred: changing a role *after* first login. `role` is
    validated the same way `bulk_update_category` validates `category` —
    against the fixed list backing the column's own `CHECK` constraint,
    so a typo fails as a clean `422` rather than a raw `IntegrityError`.

    Blocks demoting the last remaining `admin` — without at least one
    admin, nothing could ever grant `USER_MANAGE_ROLES` again, including
    to fix this exact mistake. Only checked when the target is currently
    `admin` and the new role isn't; every other change (including
    promoting a second admin, or a no-op re-save of the same role) is
    unaffected.
    """
    target = db.get(AppUser, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.role not in APP_USER_ROLES:
        raise HTTPException(
            status_code=422,
            detail={"error": "invalid_role", "message": f"'{payload.role}' is not a recognized role."},
        )

    if target.role == "admin" and payload.role != "admin":
        admin_count = db.query(AppUser).filter(AppUser.role == "admin").count()
        if admin_count <= 1:
            raise HTTPException(
                status_code=409,
                detail={"error": "last_admin", "message": "Cannot demote the last remaining admin."},
            )

    target.role = payload.role
    log_activity(
        db,
        action="role_changed",
        entity_type="app_user",
        entity_id=user_id,
        actor=user.id,
        metadata={"role": payload.role},
    )
    db.commit()
    db.refresh(target)
    return target
