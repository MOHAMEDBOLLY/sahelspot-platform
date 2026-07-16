# Architecture

## Status

Technology stack is **finalized** as of Sprint 0.5. No application code has been implemented yet — that begins in a future sprint, built against the stack below.

## Guiding principles

These principles govern every architectural decision in this project:

- **Simplicity over cleverness.** Choose the boring, well-understood solution.
- **No unnecessary abstractions.** Add structure only when a real, current need justifies it.
- **No premature optimization.** Optimize when a measured problem exists, not before.
- **No microservices.** This is a single, cohesive application, not a distributed system.
- **Small, incremental sprints.** Architecture evolves in reviewed, approved steps.

## Technology stack

### Frontend — DataLab Next (`datalab-next/`)

- **React** — UI library.
- **Vite** — build tool and dev server.
- **TypeScript** — static typing.
- **Tailwind CSS** — styling.
- **React Router** — client-side routing.
- **React Hook Form** — form state and validation.
- **TanStack Query** — server-state management / data fetching.
- **Lucide Icons** — icon set.

### Backend — API (`api/`)

- **Python 3.12**
- **FastAPI** — web framework.
- **SQLAlchemy 2** — ORM / database toolkit.
- **Alembic** — database migrations.

### Database

- **Supabase (PostgreSQL)**

## Repository structure

```
sahelspot-platform/
├── api/             # Backend — Python 3.12 / FastAPI / SQLAlchemy 2 / Alembic
├── datalab-next/    # Frontend — React / Vite / TypeScript
└── docs/            # Project documentation
```

Neither `api/` nor `datalab-next/` contains application code, dependencies, or scaffolding yet — the stack is decided, but implementation has not started.

## Decisions still open

The stack itself is fixed. The following implementation details remain open and will be addressed in future sprints as they come up:

- Database schema design (see [`DATABASE.md`](DATABASE.md)).
- API endpoint design and conventions (see [`API.md`](API.md)).
- Deployment/hosting model.
- Authentication approach (Supabase Auth is the likely default, to be confirmed).
