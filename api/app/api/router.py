from fastapi import APIRouter, Depends

from app.api.routes import activity, destinations, me, public, publish, system, venues
from app.auth.dependencies import get_current_user

# The API boundary (Sprint 23) — explicit, structural, not conventional.
#
# Every editorial route (entity CRUD, workflow transitions, publish
# actions, revision inspection, activity log, and — as of Sprint 24 —
# /me) is mounted under /editor, gated by `get_current_user` at the
# *router* level — a route added here in the future is at least
# authenticated by default, not by remembering to add
# `Depends(get_current_user)` to it individually. This blanket gate is
# deliberately kept even though Sprint 24 also introduced per-route
# `require_permission(...)` checks (see `app/auth/permissions.py`): the
# router-level dependency is the safety net if a future route forgets its
# specific permission check, and every route's own `require_permission`
# reads the exact same cached `CurrentUser` this produces — no repeated
# token verification.
#
# Every public route (snapshot-backed reads only) is mounted under
# /public, with no auth — this is the contract a future mobile app or
# integration is meant to call.
#
# /system's `/` and `/health` stay unprefixed — infrastructure, not
# editorial or public content.
editor_router = APIRouter(prefix="/editor", dependencies=[Depends(get_current_user)])
editor_router.include_router(destinations.router)
editor_router.include_router(venues.router)
editor_router.include_router(publish.router)
editor_router.include_router(activity.router)
editor_router.include_router(me.router)

public_router = APIRouter(prefix="/public")
public_router.include_router(public.router)

api_router = APIRouter()
api_router.include_router(system.router)
api_router.include_router(editor_router)
api_router.include_router(public_router)
