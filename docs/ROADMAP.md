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

## Sprint 2 — Database Design ✅

- Reviewed the supplied business-data workspace (`current_workspace.json`) and designed an initial 8-table schema in `docs/DATABASE.md`, covering every business entity, relationship, normalization decision, constraint, index, and future-proofing note.
- Explicitly excluded DataLab curation-tool bookkeeping (import logs, QA dashboards, merge history) from the schema — modeled the product, not the tool that assembled its data.
- Design only — no SQL, no models, no migrations.

## Sprint 2.5 — Schema Review ✅

- Two rounds of critical simplification against "one developer should understand the whole schema in one sitting": 8 tables → 3 tables → 2 tables (`destinations`, `venues`), folding regions/districts/aliases/boundaries/categories/beaches into plain columns (text, arrays, JSONB) wherever a full table wasn't earning its cost.
- Settled primary-key strategy (preserve existing stable source IDs rather than UUIDs or new surrogate keys), a flat fixed category list, a simple two-column image model, and JSONB opening hours.
- **Product decision**: the platform will not be live-edit. Introduced the draft → publish architecture — `destinations`/`venues` are the private editorial working tables; a new `publish_revisions` table (immutable, whole-dataset JSONB snapshots) is the only thing the public site reads, with instant rollback to any previous revision. Updated `PRODUCT.md`, `ARCHITECTURE.md`, `DATABASE.md`, and `API.md` to reflect it.
- Final schema: **3 tables** (`destinations`, `venues`, `publish_revisions`). Design only — no SQL, no migrations.

## Sprint 3 — Database Schema Implementation ✅

- Implemented the approved 3-table schema as SQLAlchemy 2 models (`api/app/db/models.py`, `api/app/db/base.py`), matching `docs/DATABASE.md` field-for-field: text primary keys, CHECK-constrained status/category columns (not native enums, per the documented reasoning), JSONB/array columns, the `venues.(destination_id, slug)` unique constraint, and the partial unique index guaranteeing at most one `publish_revisions.is_current`.
- Initialized Alembic (`api/alembic/`), wired `env.py` to read `DATABASE_URL` from the app's own settings rather than a separate hardcoded value.
- Hand-wrote the first migration (`0001_initial_schema.py`) rather than relying on autogenerate, since no live database was reachable in this environment to autogenerate against; verified it via Alembic's offline SQL-rendering mode, which produced exactly the expected `CREATE TABLE`/constraint/index statements with no live DB required.
- Confirmed the API still starts and serves `/`, `/health`, and `/docs` correctly with the new modules present.
- Deliberately deferred the performance-oriented indexes from `DATABASE.md` (full-text search, geolocation composite, PostGIS) — kept only the indexes needed for correctness (FK, uniqueness) and basic navigation (`destination_id` lookup), per this sprint's "don't optimize for scale yet" instruction.
- No CRUD endpoints, business logic, authentication, or seed data — schema only. The migration has not been applied to any real database (no Supabase project connected yet in this environment).
