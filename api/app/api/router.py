from fastapi import APIRouter, Depends

from app.api.routes import activity, destinations, public, publish, system, venues
from app.auth.dependencies import get_current_user

# The API boundary (Sprint 23) — explicit, structural, not conventional.
#
# Every editorial route (entity CRUD, workflow transitions, publish
# actions, revision inspection, activity log) is mounted under /editor,
# gated by `get_current_user` at the *router* level — a route added here
# in the future requires auth by default, not by remembering to add
# `Depends(get_current_user)` to it individually. Endpoints that also need
# the caller's identity (to attribute an activity entry) still declare
# their own `user: CurrentUser = Depends(get_current_user)` — FastAPI
# caches the dependency per request, so this doesn't verify the token
# twice, it just accesses the value the router-level check already
# produced.
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

public_router = APIRouter(prefix="/public")
public_router.include_router(public.router)

api_router = APIRouter()
api_router.include_router(system.router)
api_router.include_router(editor_router)
api_router.include_router(public_router)
