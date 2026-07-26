# SahelSpot Platform

A modern, production-grade rebuild of SahelSpot's core platform, developed from a clean foundation.

This repository is a **new, independent project**. It does not share code, infrastructure, or history with any prior SahelSpot system, and this project does not reference or depend on any existing system.

## Status

✅ Platform Core is feature complete: authentication, role-based
authorization, destination/venue editorial workflows, media management,
search, bulk operations, and publishing are all implemented and tested.
Current work is operational readiness for Beta — see
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) and
[`docs/RUNBOOK.md`](docs/RUNBOOK.md).

## Technology stack

**Frontend — DataLab Next**
- React
- Vite
- TypeScript
- Tailwind CSS
- React Router
- TanStack Query
- Lucide Icons

**Backend — API**
- Python 3.12
- FastAPI
- SQLAlchemy 2
- Alembic

**Database**
- Supabase (PostgreSQL)

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the reasoning behind these choices.

## Repository layout

| Path | Purpose |
|---|---|
| [`api/`](api/) | Backend application — Python 3.12 / FastAPI / SQLAlchemy 2 / Alembic. |
| [`datalab-next/`](datalab-next/) | Frontend application — React / Vite / TypeScript. |
| [`docs/`](docs/) | Product, architecture, database, API, and roadmap documentation. |

## Development philosophy

This project is built in small, reviewed sprints:

- Small, incremental changes — no large code drops.
- Every sprint is explained and approved before implementation.
- Simplicity over cleverness; no unnecessary abstractions or premature optimization.
- A single, well-structured application — no microservices.

## Documentation

Start with [`docs/PRODUCT.md`](docs/PRODUCT.md) for what this platform is and why it exists, then [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how it's being built.

## Getting started

- Backend: see [`api/README.md`](api/README.md) for local setup.
- Frontend: `cd datalab-next && npm install && npm run dev`.
- Production deployment: see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).
