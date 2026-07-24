# Architecture

## Status

Technology stack is **finalized** as of Sprint 0.5. The API foundation (Sprint 1) is implemented and running against this stack. The database schema (designed in Sprint 2/2.5) is implemented as SQLAlchemy models and a first Alembic migration, applied and verified against a real Supabase database (Sprint 3), with a seed and three read-only smoke-test endpoints (Sprint 4). The frontend — SahelSpot Studio — has an application shell (Sprint 5), a Venues list reading live from the API (Sprint 6), and a two-panel Venue Workspace showing full detail alongside the list (Sprint 7), reading an enriched API contract (Sprint 8) that resolves `destination_id` into `destination: {id, name}` so the frontend never resolves an id itself. As of Sprint 9, the Workspace has an Edit Mode: most fields become inputs, held entirely in local React state, discarded on Cancel. Sprint 10 adds draft/dirty-state management on top — an unsaved-changes indicator, a confirmation before discarding an edit to switch venues, and a browser-refresh warning while dirty — built as a generic hook (`useDraft`) rather than Venue-specific state, since it's meant to be the foundation Save and Publish build on later. Sprint 10.5 is a milestone architecture review and cleanup pass (stale docs, duplicated constants, dirty-check correctness) before the Write Phase begins. Sprint 11 is the first write operation — Save Draft, `PATCH /venues/{venue_id}` — wired through a TanStack Query mutation that writes straight to the draft `venues` row and stays in Edit Mode afterward, deliberately with no validation. Sprint 12 adds the Validate gate itself, split into two layers per architectural decision: a `POST /venues/{venue_id}/validate` endpoint (the new `api/app/validation/` package) is the sole, canonical source of business-rule validation, while the frontend runs only generic, entity-agnostic UX checks (required-ness, length, format) to give instant typing feedback and gate the Save Draft button — the two layers share no business logic, only the same response shape. Sprint 13 evolves that same endpoint into an **Editorial Readiness** model — `valid`/`errors` unchanged, plus a derived `ready_for_review` and two additive, currently-empty extension points (`warnings`, `info`) — a distinct, stateless "would this row qualify for Review right now" question, kept separate from Review's own (not-yet-built) stateful `draft → review` transition. Sprint 14 builds that transition: `POST /venues/{venue_id}/submit-for-review` writes `status = review`, but only after calling the exact same `validate_venue()` Sprint 12/13 already built as a precondition — an editorial *action* consuming a validation *check*, not merging the two. Sprint 15 adds the second transition, `POST /venues/{venue_id}/approve` (`review → approved`) — a human editorial decision with no readiness gate of its own, deliberately not a second call to `validate_venue()` — and extracts the shared "is the venue in the expected status" guard both transitions need into a new `app/workflow/` package (`require_status()`), so the 409 logic exists once, not once per transition. Still no Publish or revisioning.

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
- **React Hook Form** — form state and validation. Still not installed as of Sprint 10.5 — Edit Mode (Sprint 9) uses plain controlled inputs, not this library. Whether the eventual Save form adopts it or continues the current pattern is an open decision for the Write Phase, not made by default.
- **TanStack Query** — server-state management / data fetching. In active use since Sprint 6 (`useVenues`, `useVenue`) for all API reads.
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
│       ├── validation/         # reusable, entity-agnostic editorial-readiness contract
│       │   ├── schemas.py       # FieldError, ValidationResult (valid/ready_for_review/errors/warnings/info), build_validation_result() — shared by every entity's readiness check
│       │   └── venues.py        # validate_venue() — the canonical Venue business rules, and only place they live
│       ├── workflow/           # reusable, entity-agnostic status-transition contract
│       │   └── transitions.py   # require_status() — the shared "is the row in the expected status" 409 guard every transition uses
│       └── api/
│           ├── router.py    # aggregates route modules
│           ├── schemas.py    # VenueOut, VenueUpdate, DestinationOut, DestinationRef
│           └── routes/
│               ├── system.py    # GET / and GET /health
│               ├── destinations.py
│               └── venues.py     # GET/PATCH /venues..., POST /venues/{id}/validate, POST /venues/{id}/submit-for-review, POST /venues/{id}/approve
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
│       │   ├── formatDate.ts      # shared display formatting
│       │   └── validation.ts      # generic, entity-agnostic UX validators (required/length/format) + runFieldRules()
│       ├── hooks/
│       │   └── useDraft.ts        # generic mode/draft/isDirty/beforeunload/commitSave — not venue-specific
│       ├── types/
│       │   ├── venue.ts          # full Venue type (GET /venues and GET /venues/{id} share this shape)
│       │   └── validation.ts      # FieldError / ValidationResult (valid/ready_for_review/errors/warnings/info) — mirrors api/app/validation/schemas.py
│       ├── features/
│       │   └── venues/
│       │       ├── api.ts                # fetchVenues(), fetchVenue(id), updateVenue(id, patch), toVenuePatch(), validateVenue(id), submitVenueForReview(id), approveVenue(id)
│       │       ├── useVenues.ts          # TanStack Query hook — list
│       │       ├── useVenue.ts           # TanStack Query hook — single venue, seeded from list cache
│       │       ├── useUpdateVenue.ts      # TanStack Query mutation — Save Draft (PATCH /venues/{id})
│       │       ├── useValidateVenue.ts    # TanStack Query mutation — Validate (POST /venues/{id}/validate)
│       │       ├── useSubmitForReview.ts   # TanStack Query mutation — Review (POST /venues/{id}/submit-for-review)
│       │       ├── useApproveVenue.ts      # TanStack Query mutation — Approval (POST /venues/{id}/approve)
│       │       ├── venueValidation.ts     # validateVenueDraft() — frontend UX rules only, no business logic
│       │       ├── venueCategories.ts    # fixed category list, mirrors the API's CHECK constraint
│       │       ├── VenueList.tsx         # presentational: clickable venue rows
│       │       ├── VenueListPanel.tsx    # stateful: loading/error/empty + VenueList
│       │       └── workspace/
│       │           ├── VenueWorkspace.tsx     # stateful: no-selection/loading/error + useDraft + useUpdateVenue + useValidateVenue + useSubmitForReview + useApproveVenue + sections
│       │           ├── WorkspaceToolbar.tsx    # Edit / Cancel / Save Draft / Validate / Submit for Review / Approve + unsaved-changes + save/submit/approve-error indicators
│       │           ├── ValidationSummary.tsx    # renders the backend's ValidationResult — ready/not-ready banner + errors/warnings/info sections (only when non-empty)
│       │           ├── WorkspaceSection.tsx    # shared section card chrome
│       │           ├── WorkspaceField.tsx       # view-mode label/value row with placeholder
│       │           ├── fields/                   # edit-mode input atoms: FieldLabel + fieldStyles (shared), TextField, TextAreaField, SelectField, CheckboxField — TextField/TextAreaField accept an optional `error` prop
│       │           └── sections/                # Basic Info, Location, Contact, Opening Hours, Images, Publishing Status — accept an `errors` prop, threaded to their edit-mode fields
│       ├── components/
│       │   ├── Sidebar.tsx
│       │   ├── Header.tsx
│       │   ├── PagePlaceholder.tsx  # shared empty / "nothing selected" state
│       │   ├── LoadingState.tsx
│       │   ├── ErrorState.tsx        # includes a retry action
│       │   └── StatusBadge.tsx
│       └── pages/
│           ├── Dashboard.tsx    # welcome page
│           ├── Venues.tsx        # owns selectedVenueId + isWorkspaceDirty; confirms before switching venues while dirty
│           ├── Destinations.tsx
│           ├── Publishing.tsx
│           └── Settings.tsx
└── docs/                    # Project documentation
```

`datalab-next/` has the application shell (Sprint 5), a Venues list (Sprint 6), a two-panel Venue Workspace (Sprint 7), an Edit Mode toggle on that Workspace (Sprint 9), and, as of Sprint 10, dirty-state awareness on top: an unsaved-changes indicator, a confirmation before discarding an edit to switch venues, and a `beforeunload` warning while dirty. As of Sprint 11, a Save Draft button (`useUpdateVenue`, a TanStack Query mutation) sends the draft's editable fields to the API, updates the query cache from the server's response on success, and keeps the workspace in Edit Mode with `isDirty` reset to false — Cancel still discards to the last saved (or original) state, unchanged. As of Sprint 12, a Validate button (`useValidateVenue`) calls the backend's canonical gate on demand and renders its structured result (`ValidationSummary`); separately, each edit-mode field now carries an inline error from a generic, reusable frontend validator (`lib/validation.ts` + `venueValidation.ts`) that only checks required-ness/length/format, gating Save Draft — never re-deciding a business rule the backend already owns. As of Sprint 13, `ValidationSummary` renders the richer Editorial Readiness shape: a top-level ready/not-ready banner driven by `ready_for_review` (not `valid`, since they're conceptually distinct even though currently equal), plus separate error/warning/info sections that render only when non-empty — so the two new fields (`warnings`, `info`), currently always `[]`, need no UI rework once a real rule starts populating them. As of Sprint 14, a "Submit for Review" button (`useSubmitForReview`) appears in the toolbar only when `!isDirty && venue.status === 'draft' && validationResult?.ready_for_review === true` — deliberately derived from the *result of an actual Validate call* rather than independently re-checking readiness client-side, so the button can never show "ready" when the backend hasn't actually said so. On success it reuses the same `commitSave` mechanism Save Draft introduced (Sprint 11) to refresh the displayed venue with the server's response (now `status: 'review'`), and clears the stale validation result, since it described a `draft` row that no longer exists in that state. As of Sprint 15, an "Approve" button (`useApproveVenue`) appears only when `!isDirty && venue.status === 'review'` — deliberately *not* gated on `validationResult`, since Approval is a human editorial decision and never re-runs Editorial Readiness; it also reuses `commitSave` on success and disappears once `status` moves to `approved`, per the same "derive visibility from the real venue state, never a locally-tracked flag" pattern the other two action buttons already follow. `api/` has app startup, config, logging, a live Supabase/PostgreSQL connection, a migrated and verified data model (Sprint 3), three read endpoints reading directly from the draft tables and enriched to resolve `destination_id` server-side (Sprint 4, 8), CORS configured for the Studio dev origin including `PATCH` (Sprint 11) and `POST` (Sprint 12), one write endpoint — `PATCH /venues/{venue_id}` (Sprint 11) — one Editorial Readiness endpoint, `POST /venues/{venue_id}/validate` (Sprint 12, response shape extended Sprint 13), backed by a new `app/validation/` package designed to be reused by future entities' readiness checks, including a shared `build_validation_result()` that derives `valid`/`ready_for_review` in exactly one place, and two editorial-action endpoints — `POST /venues/{venue_id}/submit-for-review` (Sprint 14) and `POST /venues/{venue_id}/approve` (Sprint 15) — the only places in the codebase that write `venues.status`, both built on a shared `app/workflow/` package's `require_status()` guard rather than each re-implementing the same 409 check — the endpoints themselves are still not the final public API (see [Publishing architecture](#publishing-architecture) below).

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
