# Architecture

## Status

Technology stack is **finalized** as of Sprint 0.5. The API foundation (Sprint 1) is implemented and running against this stack. The database schema (designed in Sprint 2/2.5) is implemented as SQLAlchemy models and a first Alembic migration (Sprint 3), but not yet applied to any real database.

## Known deviations

- **Python version**: the stack specifies Python 3.12. This is not installed on the current development machine, and Homebrew cannot install it without a permissions fix on `/usr/local` that requires explicit `sudo` approval. Per project decision, local development is proceeding on **Python 3.13** temporarily. This is a one-line fix (recreate the venv under 3.12) once the environment is sorted — no code depends on 3.13-specific behavior.

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
├── api/                     # Backend — Python 3.12 (currently 3.13, see deviation above) / FastAPI / SQLAlchemy 2 / Alembic
│   ├── requirements.txt
│   ├── .env.example
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py           # reads DATABASE_URL from app settings, not a separate config
│   │   └── versions/
│   │       └── 0001_initial_schema.py  # destinations, venues, publish_revisions
│   └── app/
│       ├── main.py          # FastAPI app creation + startup
│       ├── core/
│       │   ├── config.py    # environment-driven settings (pydantic-settings)
│       │   └── logging.py   # logging setup
│       ├── db/
│       │   ├── session.py   # SQLAlchemy engine (Supabase/Postgres)
│       │   ├── base.py      # declarative Base
│       │   └── models.py    # Destination, Venue, PublishRevision ORM models
│       └── api/
│           ├── router.py    # aggregates route modules
│           └── routes/
│               └── system.py  # GET / and GET /health
├── datalab-next/            # Frontend — React / Vite / TypeScript (not yet started)
└── docs/                    # Project documentation
```

`datalab-next/` contains no application code, dependencies, or scaffolding yet — the stack is decided, but frontend implementation has not started. `api/` has app startup, config, logging, a Supabase/PostgreSQL connection, two endpoints (`/` and `/health`), and the full data model (Sprint 3) as SQLAlchemy models plus a first migration — not yet applied to a real database. No CRUD endpoints, business logic, or authentication exist yet.

## Publishing architecture

The platform is **not live-edit** — see [`PRODUCT.md`](PRODUCT.md#content--publishing-model) for the product-level reasoning. Architecturally, this means the system has two distinct data-access paths, not one:

- **Editorial path** (future, authenticated): reads and writes the draft working tables (`destinations`, `venues` — see [`DATABASE.md`](DATABASE.md)). This is where content is created, edited, validated, and moved through review. Nothing here is visible to the public.
- **Public path**: reads *only* from the current **publish revision** — an immutable snapshot created each time content is published. The public website and public API never query the draft tables directly, under any circumstance. This isn't an optimization; it's the mechanism that guarantees draft content can't leak to the public site by accident.

Publishing is a single, explicit action that freezes the current approved content into a new revision and makes it the one the public path reads. Rolling back is repointing the public path at an older revision — no re-editing, no data mutation, effectively instant. See [`DATABASE.md`](DATABASE.md#publishing-model) for how this is modeled, and [`API.md`](API.md) for the planned editorial vs. public endpoint split.

This principle interacts with the existing guiding principles above, not around them: it's still one application, still no microservices — the "two paths" are two ways of *reading* the same Postgres database, not two separate systems.

## Decisions still open

The stack itself is fixed. The following implementation details remain open and will be addressed in future sprints as they come up:

- Database schema design (see [`DATABASE.md`](DATABASE.md)).
- API endpoint design and conventions beyond the Sprint 1 foundation (see [`API.md`](API.md)).
- Deployment/hosting model.
- Authentication approach (Supabase Auth is the likely default, to be confirmed) — this now also gates who can edit drafts, approve reviews, publish, and roll back, none of which is decided yet.
- Whether publishing is always all-or-nothing (the whole dataset, as currently designed) or will eventually support scoped/partial publishes (e.g. just one destination) — see [`DATABASE.md`](DATABASE.md#questions-before-the-first-migration).
