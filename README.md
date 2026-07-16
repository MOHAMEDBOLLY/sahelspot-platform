# SahelSpot Platform

A modern, production-grade rebuild of SahelSpot's core platform, developed from a clean foundation.

This repository is a **new, independent project**. It does not share code, infrastructure, or history with any prior SahelSpot system, and this project does not reference or depend on any existing system.

## Status

🚧 Foundation stage. Technology stack is finalized (Sprint 0.5). No application code has been written yet.

## Technology stack

**Frontend — DataLab Next**
- React
- Vite
- TypeScript
- Tailwind CSS
- React Router
- React Hook Form
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

Nothing is installed or runnable yet — the stack is finalized but no application code, dependencies, or scaffolding exist. Setup instructions will be added here once the `api/` and `datalab-next/` projects are initialized.
