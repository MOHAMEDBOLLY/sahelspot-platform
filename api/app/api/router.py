from fastapi import APIRouter

from app.api.routes import activity, destinations, publish, system, venues

api_router = APIRouter()
api_router.include_router(system.router)
api_router.include_router(destinations.router)
api_router.include_router(venues.router)
api_router.include_router(publish.router)
api_router.include_router(activity.router)
