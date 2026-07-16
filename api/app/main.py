from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.logging import setup_logging

setup_logging()

app = FastAPI(title=settings.app_name, version=settings.app_version)

# Allows the Studio dev server (Vite, a different origin) to call this API
# from the browser. Local dev origins only for now — revisit once Studio
# has a real deployed URL.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET", "PATCH", "POST"],
    allow_headers=["*"],
)

app.include_router(api_router)
