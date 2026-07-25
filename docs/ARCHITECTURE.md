# Architecture

## Status

Technology stack is **finalized** as of Sprint 0.5. The API foundation (Sprint 1) is implemented and running against this stack. The database schema (designed in Sprint 2/2.5) is implemented as SQLAlchemy models and a first Alembic migration, applied and verified against a real Supabase database (Sprint 3), with a seed and three read-only smoke-test endpoints (Sprint 4). The frontend — SahelSpot Studio — has an application shell (Sprint 5), a Venues list reading live from the API (Sprint 6), and a two-panel Venue Workspace showing full detail alongside the list (Sprint 7), reading an enriched API contract (Sprint 8) that resolves `destination_id` into `destination: {id, name}` so the frontend never resolves an id itself. As of Sprint 9, the Workspace has an Edit Mode: most fields become inputs, held entirely in local React state, discarded on Cancel. Sprint 10 adds draft/dirty-state management on top — an unsaved-changes indicator, a confirmation before discarding an edit to switch venues, and a browser-refresh warning while dirty — built as a generic hook (`useDraft`) rather than Venue-specific state, since it's meant to be the foundation Save and Publish build on later. Sprint 10.5 is a milestone architecture review and cleanup pass (stale docs, duplicated constants, dirty-check correctness) before the Write Phase begins. Sprint 11 is the first write operation — Save Draft, `PATCH /venues/{venue_id}` — wired through a TanStack Query mutation that writes straight to the draft `venues` row and stays in Edit Mode afterward, deliberately with no validation. Sprint 12 adds the Validate gate itself, split into two layers per architectural decision: a `POST /venues/{venue_id}/validate` endpoint (the new `api/app/validation/` package) is the sole, canonical source of business-rule validation, while the frontend runs only generic, entity-agnostic UX checks (required-ness, length, format) to give instant typing feedback and gate the Save Draft button — the two layers share no business logic, only the same response shape. Sprint 13 evolves that same endpoint into an **Editorial Readiness** model — `valid`/`errors` unchanged, plus a derived `ready_for_review` and two additive, currently-empty extension points (`warnings`, `info`) — a distinct, stateless "would this row qualify for Review right now" question, kept separate from Review's own (not-yet-built) stateful `draft → review` transition. Sprint 14 builds that transition: `POST /venues/{venue_id}/submit-for-review` writes `status = review`, but only after calling the exact same `validate_venue()` Sprint 12/13 already built as a precondition — an editorial *action* consuming a validation *check*, not merging the two. Sprint 15 adds the second transition, `POST /venues/{venue_id}/approve` (`review → approved`) — a human editorial decision with no readiness gate of its own, deliberately not a second call to `validate_venue()` — and extracts the shared "is the venue in the expected status" guard both transitions need into a new `app/workflow/` package (`require_status()`), so the 409 logic exists once, not once per transition. Sprint 16 adds the Publish Engine — deliberately its own package, `app/publishing/`, separate from both `validation/` and `workflow/`, since Publishing is not a status change but a whole-dataset snapshot operation: `POST /publish` gathers every `approved` destination/venue into a new immutable `publish_revisions` row and atomically repoints `is_current` (never editing or deleting a past revision), and `GET /published/venues` is the first public read path — it reads only that frozen snapshot, never the draft tables, so draft/in-review/approved-but-unpublished content can never leak into it. Sprint 17 adds the read-only Revision Browser on top — `GET /publish/revisions` (history list) and `GET /publish/revisions/{id}` (a single revision's metadata plus snapshot), plus a real Studio page (`pages/Publishing.tsx`, previously a placeholder) to inspect them — deliberately inspection-only: nothing here assigns `is_current` or restores anything, keeping it a distinct concept from Rollback. Sprint 18 builds exactly that mechanism, named Republish: `POST /publish/revisions/{id}/republish` moves the `is_current` pointer to an existing revision, atomically, and nothing else — no new snapshot, no regenerated data, no edit to any revision's stored fields. It reuses the Revision Browser's list/detail views verbatim for "which revision did you mean," and the Republish button on the detail page is the only new UI, appearing only when the selected revision isn't already current. Sprint 19 adds the Editorial Activity Log — a new `app/activity/` package, cross-cutting infrastructure independent of `validation/`, `workflow/`, and `publishing/`: its `log_activity()` is called from all four editorial actions (Submit for Review, Approve, Publish, Republish) but never influences whether any of them succeeds, and a new `GET /activity` route reads the resulting `activity_log` table, newest first. No authentication exists yet, so every entry is attributed to a placeholder actor (`"system"`) until a real user identity can be threaded through the same function signature. Sprint 20 is an architecture review (chat-only, no code) followed by this project's first automated test infrastructure — see [`TESTING.md`](TESTING.md) for the full strategy. Backend tests (`api/tests/`, pytest) cover the editorial workflow, publishing, and activity logging against the real Supabase dev database (no local Postgres/Docker is available in this environment, and the models' Postgres-specific types wouldn't be faithfully exercised by SQLite), isolated by convention — `test-`-prefixed ids, factory fixtures that track and clean up everything they create, and an autouse fixture that watermarks the two global append-only tables (`publish_revisions`, `activity_log`) before each test and deletes anything created above that mark after. A minimal frontend foundation (Vitest, React Testing Library, one smoke test) was also added, deliberately without broad UI coverage. Sprint 21 is the first entity expansion: Destinations get a full read/edit workspace by reusing — not forking — the architecture Sprints 9–12 built for Venues. Backend: `GET /destinations/{id}` and `PATCH /destinations/{id}` (a `DestinationUpdate` schema mirroring `VenueUpdate`'s shape exactly), no new packages needed since `app/validation/`, `app/workflow/`, and `app/publishing/` weren't touched at all — Review/Approval/Publish for destinations are still out of scope. Frontend: the entity-agnostic pieces of the Venue Workspace (`WorkspaceSection`, `WorkspaceField`, the edit-mode field atoms, and a newly-extracted `DraftToolbar`) moved from `features/venues/workspace/` to `components/workspace/`, a shared home both `VenueWorkspace` and the new `DestinationWorkspace` import from — `VenueWorkspace`'s own toolbar was refactored to compose `DraftToolbar` plus its Validate/Submit/Approve buttons via a slot prop, verified to render and behave identically to before. `VenueList`/`DestinationList` were deliberately *not* forced into a shared generic component — their row content differs enough (category+destination vs. region) that a shared list would need its own rendering API, which felt like over-engineering for two entities; see the Sprint 21 `ROADMAP.md` entry for the full reasoning. Sprint 22 adds real authentication — Supabase-issued JWTs verified by a new `app/auth/` package's `get_current_user()`, originally required per mutation endpoint, plus a frontend `features/auth/` package (login/logout, session restore, `ProtectedRoute`). Sprint 23 makes the API boundary structural: every editorial route moved under `/editor` (auth enforced once, at the router level, covering reads too — not just the mutations Sprint 22 gated individually), every snapshot-backed read moved under `/public` (never auth-gated), and the public API gained the `GET /public/destinations` it never had a counterpart for — see [Publishing architecture](#publishing-architecture) and `docs/API.md`'s "API boundary" section for the full reasoning and route inventory.

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
│   ├── requirements-dev.txt  # pytest, httpx, pytest-cov — test-only, never installed in prod
│   ├── pytest.ini            # testpaths = tests
│   ├── .env.example
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py           # reads DATABASE_URL from app settings, not a separate config
│   │   └── versions/
│   │       ├── 0001_initial_schema.py  # destinations, venues, publish_revisions
│   │       └── 0002_activity_log.py    # activity_log (Sprint 19)
│   ├── tests/                # see docs/TESTING.md
│   │   ├── conftest.py         # client, db, make_destination, make_venue, preserve_seed_state, _clean_global_tables
│   │   ├── test_workflow.py
│   │   ├── test_publishing.py
│   │   ├── test_activity.py
│   │   └── test_destinations.py  # Sprint 21 — reuses the make_destination fixture unchanged
│   └── app/
│       ├── main.py          # FastAPI app creation + startup
│       ├── core/
│       │   ├── config.py    # environment-driven settings (pydantic-settings)
│       │   └── logging.py   # logging setup
│       ├── db/
│       │   ├── session.py   # SQLAlchemy engine (Supabase/Postgres)
│       │   ├── base.py      # declarative Base
│       │   └── models.py    # Destination, Venue, PublishRevision, ActivityLogEntry, AppUser (Sprint 24) ORM models
│       ├── auth/                # authentication + authorization — isolated behind reusable dependencies (Sprint 22, extended Sprint 24)
│       │   ├── dependencies.py   # CurrentUser{id,email,role}, get_current_user() — verifies a Supabase JWT, resolves/auto-provisions the caller's app_users role
│       │   └── permissions.py    # Sprint 24: Permission (typed enum), ROLE_PERMISSIONS (static map), require_permission() — the only thing any route depends on
│       ├── validation/         # reusable, entity-agnostic editorial-readiness contract
│       │   ├── schemas.py       # FieldError, ValidationResult (valid/ready_for_review/errors/warnings/info), build_validation_result() — shared by every entity's readiness check
│       │   └── venues.py        # validate_venue() — the canonical Venue business rules, and only place they live
│       ├── workflow/           # reusable, entity-agnostic status-transition contract
│       │   └── transitions.py   # require_status() — the shared "is the row in the expected status" 409 guard every transition uses
│       ├── publishing/         # snapshot creation only — deliberately separate from validation/ and workflow/
│       │   └── engine.py        # publish(actor), republish(actor) (snapshot + atomic pointer flip / pointer-only), get_current_revision() (the only public-read lookup)
│       ├── activity/           # cross-cutting observability — independent of validation/, workflow/, and publishing/
│       │   └── service.py       # log_activity() — the one place an activity_log row is ever created; actor is a required argument, no placeholder since Sprint 22
│       └── api/
│           ├── router.py    # Sprint 23: builds editor_router (prefix /editor, dependencies=[Depends(get_current_user)]) and public_router (prefix /public, no auth), mounts both plus system.router on api_router
│           ├── schemas.py    # VenueOut, VenueUpdate, DestinationOut, DestinationUpdate, DestinationRef, PublishRevisionOut, PublishRevisionDetail, PublishedVenueOut, PublishedDestinationOut, ActivityLogEntryOut
│           └── routes/
│               ├── system.py       # GET / and GET /health — unprefixed, mounted directly on api_router
│               ├── destinations.py  # mounted under /editor: GET/PATCH /destinations...
│               ├── venues.py        # mounted under /editor: GET/PATCH /venues..., POST /venues/{id}/validate, POST /venues/{id}/submit-for-review, POST /venues/{id}/approve
│               ├── publish.py       # mounted under /editor: POST /publish (action), GET /publish/revisions[/{id}] (read-only history), POST /publish/revisions/{id}/republish — editorial revision management only
│               ├── activity.py      # mounted under /editor: GET /activity — read-only, newest first
│               └── public.py        # Sprint 23, mounted under /public, no auth: GET /venues, GET /destinations — both read only publish_revisions' snapshot; no import of the Destination/Venue models at all, by design
├── datalab-next/            # Frontend — SahelSpot Studio — React / Vite / TypeScript / Tailwind
│   ├── index.html
│   ├── package.json          # "test": "vitest run", "test:watch": "vitest"
│   ├── vite.config.ts       # Vite + Tailwind v4 plugin + Vitest config (environment: jsdom, setupFiles)
│   └── src/
│       ├── test/
│       │   └── setup.ts        # imports @testing-library/jest-dom/vitest, shared by every test file
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
│       │   ├── destination.ts     # full Destination type (Sprint 21) — GET /destinations and GET /destinations/{id} share this shape
│       │   └── validation.ts      # FieldError / ValidationResult (valid/ready_for_review/errors/warnings/info) — mirrors api/app/validation/schemas.py
│       ├── features/
│       │   ├── auth/              # Sprint 22 — session state, isolated behind reusable abstractions
│       │   │   ├── supabaseClient.ts   # the ONLY file that imports @supabase/supabase-js
│       │   │   ├── authService.ts      # the ONLY other file allowed to import supabaseClient — every other file goes through this
│       │   │   ├── authContextValue.ts # AuthContext + AuthContextValue type (split out from AuthContext.tsx for Fast Refresh)
│       │   │   ├── AuthContext.tsx     # AuthProvider — session restore on load, stays in sync via authService.onAuthStateChange
│       │   │   ├── useAuth.ts          # the hook every feature/page actually consumes
│       │   │   ├── LoginPage.tsx       # email/password only, no self-service signup
│       │   │   └── ProtectedRoute.tsx  # wraps the whole existing route tree in App.tsx; redirects to /login when unauthenticated
│       │   ├── venues/
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
│       │           ├── WorkspaceToolbar.tsx    # Venue-specific: composes the shared DraftToolbar + Validate/Submit for Review/Approve via its extraActions/extraStatus slots (Sprint 21 refactor)
│       │           ├── ValidationSummary.tsx    # renders the backend's ValidationResult — ready/not-ready banner + errors/warnings/info sections (only when non-empty)
│       │           └── sections/                # Basic Info, Location, Contact, Opening Hours, Images, Publishing Status — accept an `errors` prop, threaded to their edit-mode fields; import WorkspaceSection/WorkspaceField/fields from components/workspace/ (Sprint 21)
│       │   ├── destinations/     # Destination Workspace (Sprint 21) — reuses the Venue-established pattern, no workflow endpoints yet
│       │       ├── api.ts                  # fetchDestinations(), fetchDestination(id), updateDestination(id, patch), toDestinationPatch()
│       │       ├── useDestinations.ts       # TanStack Query hook — list
│       │       ├── useDestination.ts        # TanStack Query hook — single destination, seeded from list cache
│       │       ├── useUpdateDestination.ts  # TanStack Query mutation — Save Draft (PATCH /destinations/{id})
│       │       ├── destinationValidation.ts # validateDestinationDraft() — same runFieldRules() pattern as venueValidation.ts (name/region required, notes length)
│       │       ├── DestinationList.tsx      # presentational: clickable destination rows — same shape as VenueList, not shared code (see ROADMAP.md's Sprint 21 entry for why)
│       │       ├── DestinationListPanel.tsx # stateful: loading/error/empty + DestinationList
│       │       └── workspace/
│       │           ├── DestinationWorkspace.tsx  # stateful: no-selection/loading/error + useDraft + useUpdateDestination + sections; uses DraftToolbar directly, no wrapper toolbar needed
│       │           └── sections/                  # Basic Information (editable), Publishing Status (read-only)
│       │   └── publishing/       # Revision Browser (Sprint 17) read-only, plus Republish (Sprint 18) — the one action, never edits a snapshot
│       │       ├── types.ts             # PublishRevisionSummary, PublishRevisionDetail, snapshot shapes — mirrors api/app/api/schemas.py
│       │       ├── api.ts               # fetchPublishRevisions(), fetchPublishRevision(id), republishRevision(id)
│       │       ├── useRevisions.ts       # TanStack Query hook — history list
│       │       ├── useRevisionDetail.ts  # TanStack Query hook — single revision incl. snapshot
│       │       ├── useRepublishRevision.ts # TanStack Query mutation — Republish (POST /publish/revisions/{id}/republish); invalidates both the list and every cached detail
│       │       ├── RevisionList.tsx      # presentational: clickable revision rows + Current badge
│       │       ├── RevisionListPanel.tsx # stateful: loading/error/empty + RevisionList
│       │       ├── RevisionField.tsx     # local label/value atom (this feature has no edit mode to share WorkspaceField with)
│       │       └── RevisionDetail.tsx    # stateful: no-selection/loading/error + metadata + snapshot summary + Republish button (shown only when not current)
│       │   └── activity/         # Editorial Activity Log (Sprint 19) — read-only, no mutation, no filtering
│       │       ├── types.ts           # ActivityLogEntry — mirrors api/app/api/schemas.py's ActivityLogEntryOut
│       │       ├── api.ts             # fetchActivity()
│       │       ├── useActivity.ts     # TanStack Query hook — the only hook in this feature
│       │       ├── ActivityTable.tsx  # presentational: timestamp/action/entity/metadata columns, newest first
│       │       └── ActivityPanel.tsx  # stateful: loading/error/empty + ActivityTable
│       ├── components/
│       │   ├── Sidebar.tsx
│       │   ├── Header.tsx
│       │   ├── PagePlaceholder.tsx  # shared empty / "nothing selected" state
│       │   ├── LoadingState.tsx
│       │   ├── ErrorState.tsx        # includes a retry action
│       │   ├── StatusBadge.tsx
│       │   ├── StatusBadge.test.tsx  # the one smoke test Sprint 20 adds — proves the Vitest setup itself works
│       │   └── workspace/            # entity-agnostic workspace primitives — moved here from features/venues/workspace/ in Sprint 21, when Destinations became the second consumer
│       │       ├── types.ts             # WorkspaceMode
│       │       ├── WorkspaceSection.tsx  # shared section card chrome
│       │       ├── WorkspaceField.tsx    # view-mode label/value row with placeholder
│       │       ├── DraftToolbar.tsx      # Edit/Cancel/Save Draft shell + dirty indicator + error text; extraActions/extraStatus slots for entity-specific buttons (Venue's Validate/Submit/Approve)
│       │       └── fields/                # edit-mode input atoms: FieldLabel + fieldStyles, TextField, TextAreaField, SelectField, CheckboxField
│       └── pages/
│           ├── Dashboard.tsx    # welcome page
│           ├── Venues.tsx        # owns selectedVenueId + isWorkspaceDirty; confirms before switching venues while dirty
│           ├── Destinations.tsx  # Destination Workspace (Sprint 21) — same two-panel shape as Venues.tsx, incl. dirty-check confirmation
│           ├── Publishing.tsx    # Revision Browser (Sprint 17) — owns selectedRevisionId; two-panel RevisionListPanel + RevisionDetail
│           ├── Activity.tsx      # Editorial Activity Log (Sprint 19) — single-panel, read-only ActivityPanel
│           └── Settings.tsx
└── docs/                    # Project documentation
```

`datalab-next/` has the application shell (Sprint 5), a Venues list (Sprint 6), a two-panel Venue Workspace (Sprint 7), an Edit Mode toggle on that Workspace (Sprint 9), and, as of Sprint 10, dirty-state awareness on top: an unsaved-changes indicator, a confirmation before discarding an edit to switch venues, and a `beforeunload` warning while dirty. As of Sprint 11, a Save Draft button (`useUpdateVenue`, a TanStack Query mutation) sends the draft's editable fields to the API, updates the query cache from the server's response on success, and keeps the workspace in Edit Mode with `isDirty` reset to false — Cancel still discards to the last saved (or original) state, unchanged. As of Sprint 12, a Validate button (`useValidateVenue`) calls the backend's canonical gate on demand and renders its structured result (`ValidationSummary`); separately, each edit-mode field now carries an inline error from a generic, reusable frontend validator (`lib/validation.ts` + `venueValidation.ts`) that only checks required-ness/length/format, gating Save Draft — never re-deciding a business rule the backend already owns. As of Sprint 13, `ValidationSummary` renders the richer Editorial Readiness shape: a top-level ready/not-ready banner driven by `ready_for_review` (not `valid`, since they're conceptually distinct even though currently equal), plus separate error/warning/info sections that render only when non-empty — so the two new fields (`warnings`, `info`), currently always `[]`, need no UI rework once a real rule starts populating them. As of Sprint 14, a "Submit for Review" button (`useSubmitForReview`) appears in the toolbar only when `!isDirty && venue.status === 'draft' && validationResult?.ready_for_review === true` — deliberately derived from the *result of an actual Validate call* rather than independently re-checking readiness client-side, so the button can never show "ready" when the backend hasn't actually said so. On success it reuses the same `commitSave` mechanism Save Draft introduced (Sprint 11) to refresh the displayed venue with the server's response (now `status: 'review'`), and clears the stale validation result, since it described a `draft` row that no longer exists in that state. As of Sprint 15, an "Approve" button (`useApproveVenue`) appears only when `!isDirty && venue.status === 'review'` — deliberately *not* gated on `validationResult`, since Approval is a human editorial decision and never re-runs Editorial Readiness; it also reuses `commitSave` on success and disappears once `status` moves to `approved`, per the same "derive visibility from the real venue state, never a locally-tracked flag" pattern the other two action buttons already follow. As of Sprint 17, the Publishing page is real (`features/publishing/`) — a two-panel Revision Browser mirroring the Venues page's list/detail shape but read-only throughout: `RevisionListPanel` shows history newest-first with a "Current" badge on whichever revision `is_current`, and selecting one loads `RevisionDetail` (metadata plus a snapshot summary of included destinations/venues). As of Sprint 18, `RevisionDetail` also renders a "Republish" button, shown only when the selected revision isn't already current — clicking it calls `useRepublishRevision`, which invalidates both the revision-list query and every cached revision-detail query on success (a full refetch rather than a targeted cache patch, since republishing flips `is_current` on two different rows at once — the old current and the new one — so no single-entry update could keep every cached view correct). As of Sprint 19, a new Activity page (`features/activity/`) renders a single read-only table — timestamp, action, entity, metadata, newest first — with no selection state, no detail view, and no mutation hook anywhere in the feature; it's the simplest page in the Studio precisely because it has nothing to do but display. `api/` has app startup, config, logging, a live Supabase/PostgreSQL connection, a migrated and verified data model (Sprint 3, extended Sprint 19 with a fourth table), three read endpoints reading directly from the draft tables and enriched to resolve `destination_id` server-side (Sprint 4, 8), CORS configured for the Studio dev origin including `PATCH` (Sprint 11) and `POST` (Sprint 12), one write endpoint — `PATCH /venues/{venue_id}` (Sprint 11) — one Editorial Readiness endpoint, `POST /venues/{venue_id}/validate` (Sprint 12, response shape extended Sprint 13), backed by a new `app/validation/` package designed to be reused by future entities' readiness checks, including a shared `build_validation_result()` that derives `valid`/`ready_for_review` in exactly one place, two editorial-action endpoints — `POST /venues/{venue_id}/submit-for-review` (Sprint 14) and `POST /venues/{venue_id}/approve` (Sprint 15) — the only places in the codebase that write `venues.status`, both built on a shared `app/workflow/` package's `require_status()` guard rather than each re-implementing the same 409 check, the Publish Engine (Sprint 16): `POST /publish` (snapshot + atomic `is_current` flip, backed by a new `app/publishing/` package) and `GET /published/venues` (the first endpoint that reads only a frozen snapshot, never the draft `venues`/`destinations` tables), two read-only revision-history endpoints (Sprint 17), `GET /publish/revisions` and `GET /publish/revisions/{id}`, `POST /publish/revisions/{id}/republish` (Sprint 18) — the same `app/publishing/engine.py` module's second function, `republish()`, reusing the exact atomic pointer-flip `publish()` established, just without a snapshot step — and, as of Sprint 19, `GET /activity`, backed by a new `app/activity/` package whose `log_activity()` is called from all four editorial-action call sites above without any of them needing to duplicate how an activity entry is shaped. As of Sprint 21, Destinations gained `GET /destinations/{id}` and `PATCH /destinations/{id}` — the exact `update_venue` pattern reused verbatim (a `DestinationUpdate` schema, partial-update semantics, 404-on-missing) — and the frontend gained a full Destination Workspace (`features/destinations/`) built on the same `useDraft` hook and a newly shared `components/workspace/` (moved out of `features/venues/workspace/`, which now imports from it too) rather than a forked copy of the Venue Workspace's UI. No new backend package was needed for Destinations — `app/validation/`, `app/workflow/`, and `app/publishing/` were all left untouched, since Review/Approval/Publish for destinations remain out of scope — the endpoints themselves are still not the final public API (see [Publishing architecture](#publishing-architecture) below). Sprint 22 adds real authentication: a new `app/auth/` package (`get_current_user()`) verifies Supabase-issued JWTs and is now required by every mutation endpoint — `PATCH /venues/{id}`, `POST /venues/{id}/submit-for-review`, `POST /venues/{id}/approve`, `PATCH /destinations/{id}`, `POST /publish`, `POST /publish/revisions/{id}/republish` — while every read endpoint stays open. The backend never calls Supabase's Auth API itself and stores no session; it only verifies tokens the frontend already obtained. `app/activity/service.py`'s `PLACEHOLDER_ACTOR` is gone — every activity entry's `actor` is now the authenticated caller's real Supabase user id. On the frontend, a new `features/auth/` package (`supabaseClient.ts` — the only file that calls the Supabase SDK; `authService.ts` — the only other file allowed to import it, and the only interface every other file uses) adds session restore, login/logout, and a `ProtectedRoute` wrapping the entire existing route tree; `apiClient.ts`'s mutation helpers now attach the current session's access token. Sprint 23 makes the editorial/public split from [Publishing architecture](#publishing-architecture) below structural rather than conventional: every route above (all of `destinations.py`, `venues.py`, `publish.py`'s revision-management endpoints, `activity.py`) moved under a new `/editor` prefix, gated by `get_current_user` at the *router* level (`editor_router = APIRouter(prefix="/editor", dependencies=[Depends(get_current_user)])`) rather than per-endpoint as Sprint 22 had it — every `/editor/*` route now requires auth, including the reads that were previously open (`GET /venues`, `GET /destinations`, `GET /activity`, revision history). `GET /published/venues` moved to `GET /public/venues` under a new, unauthenticated `public_router` (prefix `/public`), and a new `GET /public/destinations` (`routes/public.py`) gives the public API the destinations counterpart it never had — both read only `publish_revisions`' current snapshot, via the same `get_current_revision()` helper, and the file has no import of the `Destination`/`Venue` models at all, so an accidental draft-table read there would require an obvious new import, not just a missed filter. No business logic changed: `app/validation/`, `app/workflow/`, `app/publishing/engine.py`, and `app/activity/service.py` are untouched — this sprint moved routes and centralized where auth is checked, nothing else. The frontend's `api.ts` files across `features/venues/`, `features/destinations/`, `features/publishing/`, `features/activity/` were updated to call the new `/editor/*` paths; nothing in Studio calls `/public/*` yet (it's the contract a future public consumer will use). Sprint 24 layers authorization on top of Sprint 23's authentication gate, without replacing it: a new `app/auth/permissions.py` defines a typed `Permission` enum and a static `ROLE_PERMISSIONS` map (four fixed roles — `viewer`/`editor`/`publisher`/`admin` — each a strict superset of the one below it), and every `/editor/*` route now also depends on `require_permission(Permission.X)` — no route anywhere references a role name. Roles live in a new `app_users` table (Sprint 24 migration, `0003_app_users.py`), resolved by an extended `get_current_user()` that auto-provisions a `viewer` row on first login (or `admin`, for one configured bootstrap user id) and returns it as part of `CurrentUser`. The one new endpoint is `GET /editor/me`; `GET /editor/users`/`PATCH /editor/users/{id}` (managing other users' roles) are explicitly deferred. On the frontend, `AuthContext` fetches `/editor/me` once a session exists and exposes `role`; a new `features/auth/permissions.ts` mirrors the backend's map (UX-only) to hide, not just disable, buttons the caller's role doesn't grant.

## Publishing architecture

The platform is **not live-edit** — see [`PRODUCT.md`](PRODUCT.md#content--publishing-model) for the product-level reasoning. Architecturally, this means the system has two distinct data-access paths, not one:

As of Sprint 23, this is no longer just a data-access convention — it's two structurally separate route namespaces, `/editor` and `/public` (`api/app/api/router.py`), each with different code, different auth, and (for `/public`) no import path that could even reach the draft tables:

- **Editorial path** (`/editor/*` — every route requires a logged-in Supabase user as of Sprint 23, enforced once at the router level via `dependencies=[Depends(get_current_user)]`, not per endpoint as Sprint 22 had it; this now covers reads too, not just mutations): reads and writes the draft working tables (`destinations`, `venues` — see [`DATABASE.md`](DATABASE.md)). This is where content is created, edited, validated, and moved through Review/Approval (Sprints 9–15). Nothing here is visible to the public.
- **Public path** (`/public/*`, Sprint 23; previously unprefixed `GET /published/venues` from Sprint 16): reads *only* from the current **publish revision** — an immutable snapshot created each time content is published. `GET /public/venues` and `GET /public/destinations` (the latter added Sprint 23) read exclusively from `publish_revisions`, never the draft tables, under any circumstance — and, as of Sprint 23, `routes/public.py` doesn't even import the `Destination`/`Venue` models, so this isn't just a convention a developer has to remember, it's a file that structurally cannot query the draft tables without an obvious new import. This isn't an optimization; it's the mechanism that guarantees draft content can't leak to the public site by accident.

Publishing (`POST /editor/publish`, Sprint 16) is a single, explicit action that freezes the current `approved` content into a new revision and makes it the one the public path reads — implemented in `api/app/publishing/engine.py`. Rolling back — repointing the public path at an older revision, no re-editing, no data mutation, effectively instant — is real as of Sprint 18, named Republish (`POST /editor/publish/revisions/{id}/republish`): the same module's `republish()` function reuses the exact atomic single-current-revision-pointer pattern `publish()` established, just without building a new snapshot. Both `publish()` and `republish()` require the caller's identity (Sprint 22) — attributed as the activity log's `actor` — but still no roles/permissions: any authenticated user may publish or roll back. See [`DATABASE.md`](DATABASE.md#publishing-model) for how this is modeled, and [`API.md`](API.md#republish-sprint-18) for the implementation and what's still open (a richer Rollback UX — confirmation/diff preview).

This principle interacts with the existing guiding principles above, not around them: it's still one application, still no microservices — the "two paths" are two ways of *reading* the same Postgres database, not two separate systems.

## Decisions still open

The stack itself is fixed. The following implementation details remain open and will be addressed in future sprints as they come up:

- Database schema design (see [`DATABASE.md`](DATABASE.md)).
- API endpoint design and conventions beyond the Sprint 1 foundation (see [`API.md`](API.md)).
- Deployment/hosting model.
- Roles/permissions — Sprint 22/23 answer "logged in or not" (Supabase Auth, enforced structurally at the `/editor` router level as of Sprint 23) but not "who's allowed to approve/publish/roll back specifically" — every authenticated user can currently do everything any `/editor/*` route allows. Organizations, review assignment, and a policy engine are all still undesigned.
- Whether publishing is always all-or-nothing (the whole dataset, as currently designed) or will eventually support scoped/partial publishes (e.g. just one destination) — see [`DATABASE.md`](DATABASE.md#questions-before-the-first-migration).
- Whether `/public/*` ever needs its own infrastructure (a reverse proxy, CDN caching, rate limiting) now that it's a structurally separate namespace (Sprint 23) — possible to add later without another route migration, but nothing has been added yet.
