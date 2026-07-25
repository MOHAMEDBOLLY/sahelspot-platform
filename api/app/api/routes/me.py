from fastapi import APIRouter, Depends

from app.api.schemas import MeOut
from app.auth.dependencies import CurrentUser, get_current_user

# Sprint 24 — deliberately the only endpoint this sprint adds. Gated by
# `get_current_user` alone, not `require_permission(...)` — every
# authenticated user, regardless of role, needs to be able to ask "who am
# I and what can I do," since the frontend uses `role` to decide what to
# render at all. `GET/PATCH /editor/users[...]` (listing/managing *other*
# users) are explicitly deferred — this route only ever answers about the
# caller themselves.
router = APIRouter(tags=["me"])


@router.get("/me", response_model=MeOut)
def get_me(user: CurrentUser = Depends(get_current_user)):
    return MeOut(id=user.id, email=user.email, role=user.role)
