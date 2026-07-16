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
- No CRUD endpoints, business logic, authentication, or seed data — schema only.
- **Follow-up validation**: connected to a real Supabase project and ran the migration for real. Fixed two connection-string issues along the way (missing `+psycopg` driver suffix, an unencoded `@` in the password) and a real bug in `alembic/env.py` (it round-tripped the URL through `ConfigParser`, which broke on the URL-encoded password — fixed by building the engine directly from `DATABASE_URL` instead). Verified every table, column, CHECK constraint, the FK, the unique constraint, and the partial unique index directly against Postgres system catalogs — all matched the design exactly. `GET /health` confirmed live connectivity. Committed as `Sprint 3 - Initial Database Schema`.

## Sprint 4 — Seed & Smoke Test ✅

- Added a minimal, realistic seed (`api/scripts/seed.py`): one destination (Marassi) and one venue (The Smokery), safe to re-run (`session.merge()`).
- Implemented three read-only endpoints — `GET /destinations`, `GET /venues`, `GET /venues/{venue_id}` — backed by a new SQLAlchemy session dependency (`app/db/session.get_db`) and Pydantic response schemas (`app/api/schemas.py`). No POST/PATCH/DELETE, no auth, no Studio UI, per instruction.
- Verified the full chain end-to-end against the real Supabase database: seed → SQLAlchemy → FastAPI → Swagger UI ("Try it out", not just curl) → JSON response, for all three endpoints, including a 404 case for an unknown venue id.
- **Architecture note, flagged not resolved**: these endpoints read directly from the draft `destinations`/`venues` tables, not from `publish_revisions`. That's correct for this sprint's purpose (a plumbing smoke test) but is explicitly *not* the final public API contract described in `ARCHITECTURE.md` — the real public read path (bound to the current publish revision) still needs to be built once publish/rollback endpoints exist.

## Sprint 5 — Studio Foundation ✅

- Scaffolded the frontend in `datalab-next/` (reserved for it since Sprint 0.5) using Vite's React + TypeScript template, then added React Router, TanStack Query, Lucide Icons, and Tailwind CSS v4 (via `@tailwindcss/vite`, no separate PostCSS config needed).
- Named/branded the app **SahelSpot Studio** — the editorial tool implied by the draft → publish architecture (`ARCHITECTURE.md#publishing-architecture`). Updated `PRODUCT.md` and `ARCHITECTURE.md` to reflect this; previously those referred to the frontend generically as "DataLab Next."
- Built the shell: `AppShell` layout (`Sidebar` + `Header` + routed content area), five routes (Dashboard, Venues, Destinations, Publishing, Settings) wired through React Router, a shared `navigation.ts` config so the sidebar and header title don't duplicate the route list, and a shared `PagePlaceholder` component for the four not-yet-built sections. Dashboard shows a real welcome page; the rest show a minimal "coming soon" state.
- `QueryClientProvider` is wired up in `main.tsx` per the required stack, but nothing queries anything yet — no API connection.
- Verified in-browser: production build succeeds, dev server runs, all five sidebar links navigate correctly with the right page rendering, active-state highlighting, and header title, and lint is clean. No console errors.
- No business features, no CRUD, no forms, no authentication, no API connection — shell and routing only, per instruction.

## Sprint 6 — Venue Explorer ✅

- Built the first real Studio feature: a live Venues list. `src/lib/apiClient.ts` (fetch wrapper), `src/types/venue.ts`, and `src/features/venues/` (`api.ts`, `useVenues.ts` — a TanStack Query hook, `VenueTable.tsx`) fetch from `GET /venues` and display Name, Category, Destination, Status. Read-only — no editing, creating, deleting, or publishing, per instruction.
- Added three shared, reusable state components (`LoadingState`, `ErrorState` with a retry action, `StatusBadge`) alongside the existing `PagePlaceholder`, which now doubles as the empty state.
- **Required backend change**: added CORS middleware to `api/app/main.py` (GET-only, `localhost:5173`/`127.0.0.1:5173`) — without it the browser blocks Studio's requests to the API outright, since they're different origins. Infrastructure, not a feature.
- **Found and fixed a real bug during verification**: the page initially used `isLoading` to gate the loading state, which in TanStack Query v5 is only true *during active fetching* — between retry attempts there's a pending-but-not-fetching gap where a fetch failure was misread as "no data" and showed the empty state instead of loading. Fixed by checking `isPending` instead, which covers the whole pending lifecycle including retries.
- **Diagnosed and deliberately did not "fix" a second issue**: in this automated browser test environment, `document.visibilityState` is permanently `"hidden"` (a standard headless-browser characteristic), which makes TanStack Query pause retries indefinitely via its `focusManager` — a real, intentional feature for real users (don't burn retries on a backgrounded tab), not an app bug. Verified this was the true cause by reading the library's source directly, then confirmed the error state renders correctly by forcing `visibilityState` for the test session only (never shipped). Also set `networkMode: 'always'` globally as independent, legitimate defense against unreliable `navigator.onLine` reporting.
- Verified all four states in-browser against the real Supabase-backed API: loaded (seeded venue), loading, error (API stopped — "Failed to fetch" + working "Try again" that recovers), and empty (temporarily stubbed, reverted after). Build and lint clean, no console errors.
- Business logic (status meaning, data validity) stays in the API; the frontend only fetches and displays. `destination_id` is shown as-is (e.g. `"marassi"`) since the API doesn't yet return a resolved destination name — noted as an API-side concern for later, not something to join client-side now.

## Sprint 7 — Venue Workspace (Read Only) ✅

- Built the first editing-adjacent feature's *architecture* (not the editing itself): selecting a venue from the list opens a two-panel workspace — list on the left, full venue detail on the right — on the same page, no navigation, no modal, no popup.
- Split the old `Venues.tsx` (which did everything inline) into a thin page that only owns `selectedVenueId`, a `VenueListPanel` (loading/error/empty + the list — same logic as Sprint 6, just extracted), and a new `VenueWorkspace` (no-selection/loading/error + six read-only sections). Renamed `VenueTable.tsx` → `VenueList.tsx` and gave it a compact clickable-row design (it no longer needs to be a wide table now that it lives in a narrower panel) plus selection props.
- Added `useVenue(id)` (`GET /venues/{id}`) alongside the existing `useVenues()` (`GET /venues`) — separate queries for separate resources, as instructed, but **seeded `useVenue`'s `initialData` from the already-cached venue list**, since the list endpoint already returns full venue objects. Selecting a venue already visible in the list renders instantly with no extra network round trip — directly answering "use TanStack Query properly / don't duplicate fetching."
- Six presentational section components (Basic Information, Location, Contact, Opening Hours, Images, Publishing Status), each just props-in/JSX-out, built on two shared atoms: `WorkspaceSection` (card chrome) and `WorkspaceField` (label/value row with a consistent "Not set" placeholder). No forms, no inputs, no save buttons, no editing — read-only, per instruction.
- Verified in-browser against the real Supabase-backed API: temporarily added a second venue to properly exercise selection-switching (not just single-venue display), confirmed the workspace populates instantly on selection, switching venues updates only the workspace while the list panel and its scroll position stay untouched, the URL never changes from `/venues`, and all six sections render correctly including placeholder states for every missing field. Removed the temporary venue afterward, restoring the database to the documented Sprint 4 seed. Build and lint clean, no console errors.
