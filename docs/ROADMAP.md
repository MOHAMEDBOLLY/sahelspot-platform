# Roadmap

This roadmap tracks sprints as they happen. Each entry is added when a sprint completes, not planned far in advance — scope for future sprints is decided at the start of that sprint, not before.

## Sprint 0 — Project Foundation ✅

- Clean folder structure (`backend/`, `frontend/`, `docs/`).
- Git repository initialized.
- README and core documentation created (`PRODUCT.md`, `ARCHITECTURE.md`, `DATABASE.md`, `API.md`, `ROADMAP.md`).
- No application code, frameworks, or dependencies introduced.

## Sprint 0.5 — Final Technology Stack ✅

- Technology stack finalized and locked in:
  - Frontend (**DataLab Next**): React, Vite, TypeScript, Tailwind CSS, React Router, React Hook Form, TanStack Query, Lucide Icons.
  - Backend (**API**): Python 3.12, FastAPI, SQLAlchemy 2, Alembic.
  - Database: Supabase (PostgreSQL).
- Folders renamed to match final naming: `backend/` → `api/`, `frontend/` → `datalab-next/`.
- All documentation updated to reflect the fixed stack; no items left marked TBD at the stack level.
- Still no application code, dependencies, or scaffolding introduced.

## Sprint 1 — API Foundation ✅

- Clean FastAPI project scaffolded in `api/` (`app/main.py`, `app/core/`, `app/db/`, `app/api/`).
- Application startup, environment-driven configuration, and logging configured.
- SQLAlchemy engine connected to Supabase (PostgreSQL) via `DATABASE_URL`; connectivity verified through `GET /health`, not through any application tables.
- Two endpoints implemented: `GET /` (API info) and `GET /health` (DB connectivity, `503` on failure).
- Swagger UI (`/docs`) and ReDoc (`/redoc`) verified working.
- No models, tables, migrations, CRUD, authentication, or business logic introduced.
- **Known deviation**: running on Python 3.13 locally instead of the finalized 3.12, because 3.12 isn't installed and Homebrew can't install it without a `sudo` permissions fix. Tracked in [`ARCHITECTURE.md`](ARCHITECTURE.md#known-deviations); to be standardized later.

## Sprint 2 — TBD

Awaiting approval of Sprint 1 before scoping.
