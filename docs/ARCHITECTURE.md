# Architecture

## Status

Technology stack is **finalized** as of Sprint 0.5. The API foundation (Sprint 1) is implemented and running against this stack. The database schema (designed in Sprint 2/2.5) is implemented as SQLAlchemy models and a first Alembic migration, applied and verified against a real Supabase database (Sprint 3), with a seed and three read-only smoke-test endpoints (Sprint 4). The frontend — SahelSpot Studio — has an application shell (Sprint 5), a Venues list reading live from the API (Sprint 6), and, as of Sprint 7, a two-panel Venue Workspace: selecting a venue from the list shows its full detail (`GET /venues/{id}`) in six read-only sections alongside the list, without navigating away. Still entirely read-only — no editing, forms, or auth.

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

### Frontend — SahelSpot Studio (`datalab-next/`)

- **React** — UI library.
- **Vite** — build tool and dev server.
- **TypeScript** — static typing.
- **Tailwind CSS** — styling.
- **React Router** — client-side routing.
- **React Hook Form** — form state and validation. Not yet installed — no forms exist yet (Sprint 5 is shell-only).
- **TanStack Query** — server-state management / data fetching. Wired up (`QueryClientProvider`) but unused — no API connection yet.
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
├── datalab-next/            # Frontend — SahelSpot Studio — React / Vite / TypeScript / Tailwind
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts       # Vite + Tailwind v4 plugin
│   └── src/
│       ├── main.tsx          # QueryClientProvider + BrowserRouter + App
│       ├── App.tsx            # route definitions
│       ├── config/
│       │   └── navigation.ts   # sidebar item list (path, label, icon) — shared by Sidebar + Header
│       ├── layouts/
│       │   └── AppShell.tsx    # Sidebar + Header + <Outlet />
│       ├── lib/
│       │   ├── apiClient.ts      # fetch wrapper — only place that talks HTTP to the API
│       │   └── formatDate.ts      # shared display formatting
│       ├── types/
│       │   └── venue.ts          # full Venue type (GET /venues and GET /venues/{id} share this shape)
│       ├── features/
│       │   └── venues/
│       │       ├── api.ts                # fetchVenues(), fetchVenue(id)
│       │       ├── useVenues.ts          # TanStack Query hook — list
│       │       ├── useVenue.ts           # TanStack Query hook — single venue, seeded from list cache
│       │       ├── VenueList.tsx         # presentational: clickable venue rows
│       │       ├── VenueListPanel.tsx    # stateful: loading/error/empty + VenueList
│       │       └── workspace/
│       │           ├── VenueWorkspace.tsx     # stateful: no-selection/loading/error + sections
│       │           ├── WorkspaceSection.tsx    # shared section card chrome
│       │           ├── WorkspaceField.tsx       # shared label/value row with placeholder
│       │           └── sections/                # Basic Info, Location, Contact, Opening Hours, Images, Publishing Status
│       ├── components/
│       │   ├── Sidebar.tsx
│       │   ├── Header.tsx
│       │   ├── PagePlaceholder.tsx  # shared empty / "nothing selected" state
│       │   ├── LoadingState.tsx
│       │   ├── ErrorState.tsx        # includes a retry action
│       │   └── StatusBadge.tsx
│       └── pages/
│           ├── Dashboard.tsx    # welcome page
│           ├── Venues.tsx        # thin: owns selectedVenueId, composes VenueListPanel + VenueWorkspace
│           ├── Destinations.tsx
│           ├── Publishing.tsx
│           └── Settings.tsx
└── docs/                    # Project documentation
```

`datalab-next/` has the application shell (Sprint 5), a read-only Venues list (Sprint 6), and, as of Sprint 7, a two-panel Venue Workspace — selecting a venue shows its full detail alongside the list, on the same page, with no navigation. Still no editing, forms, or auth. `api/` has app startup, config, logging, a live Supabase/PostgreSQL connection, a migrated and verified data model (Sprint 3), three read-only smoke-test endpoints reading directly from the draft tables (Sprint 4), and CORS configured for the Studio dev origin (Sprint 6) — the endpoints themselves are still not the final public API (see [Publishing architecture](#publishing-architecture) below).

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
