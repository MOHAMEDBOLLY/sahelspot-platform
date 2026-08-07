# Testing

## Status

Automated test infrastructure was added in Sprint 20, after 19 sprints of manual-only verification (a `curl`/browser pass performed once, by hand, per sprint — see each sprint's `ROADMAP.md` entry for what that looked like). Sprint 21 added the first test file for a second entity (`test_destinations.py`), reusing the fixtures Sprint 20 built without modifying them — see [What's covered](#whats-covered) below. This document covers backend tests for the editorial workflow, publishing, activity logging, and destinations, plus a minimal frontend test foundation. It does not cover Media, Authentication, AI, or any entity beyond venues/destinations.

## Backend testing strategy

### The test database is isolated, and the isolation is enforced in code

> **This supersedes the previous "why these tests run against the real
> Supabase project" rationale.** That trade-off was withdrawn after it
> caused a production incident: because `publish()` stamps
> `last_published_at` on *every* approved row and the suite issues dozens
> of publishes, a routine `pytest` run rewrote publish metadata on
> hundreds of live rows — and because `_clean_global_tables` deletes the
> `publish_revisions` rows those publishes create without restoring the
> previous pointer, it left the platform with **no current publish
> revision**, which blanks the entire public API. The Postgres-not-SQLite
> reasoning below still holds; sharing the *production* database was the
> part that was wrong.

The suite requires a **real, disposable Postgres** — the models use
Postgres-specific types (`JSONB`, `ARRAY`, a partial unique index) that a
SQLite substitute couldn't faithfully exercise: a passing SQLite test
wouldn't prove the partial-unique-index-backed "exactly one current
revision" guarantee that `publish_revisions` depends on.

Which database that is comes from **`TEST_DATABASE_URL` only**, defaulting
to `postgresql+psycopg://postgres:postgres@127.0.0.1:5432/sahelspot_test`.
`DATABASE_URL` is deliberately never consulted, so a developer's working
`.env` cannot leak into a test run.

`api/conftest.py` (the root conftest, which pytest loads before
`tests/conftest.py` and therefore before the SQLAlchemy engine is built)
calls `enforce_isolated_test_database()` from
[`api/tests/database_guard.py`](../api/tests/database_guard.py), which
applies two rules:

1. **Managed-provider hosts are refused unconditionally** — Supabase, RDS,
   Neon and similar. There is no override. Attempting it aborts the run at
   collection time, before any connection is opened.
2. **Non-loopback hosts are refused by default** — lift this only for a
   genuinely disposable remote database, with `ALLOW_REMOTE_TEST_DATABASE=1`.
   Rule 1 still applies on top.

The guard has its own tests (`tests/test_database_guard.py`) which run
without any database at all, so the safety mechanism is verifiable on any
machine.

### Setting up the local test database

Any Postgres 16 will do. With Docker:

```bash
docker run -d --name sahelspot-test-db \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=sahelspot_test \
  -p 5432:5432 postgres:16
```

Create the schema. Note `DATABASE_URL` is what **Alembic** reads — pytest
reads `TEST_DATABASE_URL` — so point it explicitly for this one command
rather than relying on whatever `.env` holds:

```bash
cd api
DATABASE_URL=postgresql+psycopg://postgres:postgres@127.0.0.1:5432/sahelspot_test alembic upgrade head
```

The database needs **schema only, no seed data** — every fixture creates
what it needs, and the seed-dependent fixtures already tolerate the seed
rows being absent.

### How isolation is achieved without a separate database

Since tests share a database with real (seed) data and each other, isolation is achieved by convention, enforced through fixtures in `api/tests/conftest.py`:

- **Every entity a test creates uses a `test-`-prefixed id** (e.g. `test-v-a1b2c3d4`), so it can never collide with the real Sprint 4 seed data (`v00001`, `marassi`).
- **Factory fixtures track everything they create and delete it in teardown**, regardless of whether the test passed or failed — `make_destination` and `make_venue` are closures that append every id they create to a list, then clean up that exact list when the test ends.
- **`publish()`/`republish()` are whole-dataset operations** — they gather *every* `approved` row, so a test that publishes will incidentally touch the real seed venue/destination's `last_published_at`. The `preserve_seed_state` fixture snapshots and restores those two fields, so a publishing test never leaves the seed data in a different state than it found it.
- **`publish_revisions` and `activity_log` are global, append-only tables with no per-entity owner** — no venue/destination fixture's teardown can clean these up, since they're not scoped to any single entity. The `_clean_global_tables` fixture (autouse, runs for every test automatically) records the max `id` in each table before the test and deletes anything created above that watermark after — a safety net no individual test needs to remember to invoke.

### Consequence: tests must run serially, not in parallel

Because isolation is convention-based (shared state, not a fresh database per test), running this suite with a parallel runner (e.g. `pytest-xdist`'s `-n auto`) would let two tests' publish-revision pointer flips or global-table watermarks race each other. This was reproduced directly during this sprint's own verification (see the Sprint 20 `ROADMAP.md` entry) — two accidentally-concurrent `pytest` invocations against the same database produced a `StaleDataError` from a second run's cleanup deleting rows a first run's `publish()` was still updating. **Do not add `pytest-xdist` or any `-n` flag without first replacing the shared-database strategy with a real per-test-run database.**

### What's covered

- **Editorial workflow** (`tests/test_workflow.py`): Submit for Review (`draft → review`) and Approve (`review → approved`) — success paths, every invalid-transition rejection (`409`), the not-ready-for-review rejection (`422`), unknown-entity `404`s, and that a rejected transition leaves the row's `status` unchanged in the database (not just that the HTTP response looked right).
- **Publishing** (`tests/test_publishing.py`): Publish (snapshot creation, exclusion of non-approved venues, pointer supersession across two publishes, draft edits after a publish not leaking into the already-published snapshot) and Republish (pointer-only move, `404`/`409`, and — critically — that the target revision's `published_at` and snapshot content are provably unchanged by being republished).
- **Activity logging** (`tests/test_activity.py`): that each of the four logged actions produces exactly the activity entry it claims to (correct `action`, `entity_type`, `entity_id`, `actor`, and `metadata` where applicable), that a *rejected* action does not log an entry, and that `GET /activity` returns entries newest-first.
- **Destinations** (`tests/test_destinations.py`, added Sprint 21): list, single-destination `404`, and Save Draft (success, partial update leaving other fields unchanged, `status` untouched, `aliases` round-tripping correctly, unknown-destination `404`, and — since Save Draft is deliberately unlogged — that it produces *no* activity entry). Notably, this file needed **zero changes to `conftest.py`** — the `make_destination` factory fixture already existed from Sprint 20, written generically enough that a second entity's test file could just use it directly. That's the extensibility this document's "How future contributors should add new tests" section below was written to enable, now demonstrated rather than just claimed.

### What's deliberately not covered

- Save Draft (`PATCH /venues/{id}`) and Validate (`POST /venues/{id}/validate`) — not named in this sprint's scope (Editorial Workflow/Publishing/Republish/Activity Logging), and covered indirectly already (every workflow test that expects a `422` is exercising the same `validate_venue()` function Validate itself calls).
- Media, Authentication, AI, and any entity other than venues/destinations — explicitly out of scope per this sprint's instructions.
- Frontend UI behavior beyond the one smoke test described below — this sprint builds the *foundation*, not broad UI coverage.

## Backend directory structure

```
api/
├── pytest.ini              # testpaths = tests
├── requirements-dev.txt     # pytest, httpx (TestClient dependency), pytest-cov — never installed in prod
└── tests/
    ├── __init__.py
    ├── conftest.py          # client, db, make_destination, make_venue, preserve_seed_state,
    │                        # _clean_global_tables (autouse), latest_activity() helper
    ├── test_workflow.py      # Submit for Review, Approve
    ├── test_publishing.py    # Publish, Republish
    ├── test_activity.py      # Activity logging side effects of the above
    └── test_destinations.py  # GET/PATCH /destinations... (Sprint 21) — reuses conftest.py's make_destination unchanged
```

## How to run the backend tests

Requires a local, disposable Postgres — see [Setting up the local test
database](#setting-up-the-local-test-database) first.

```bash
cd api
source .venv/bin/activate
pip install -r requirements-dev.txt   # once, or after requirements-dev.txt changes

python -m pytest                       # run the full suite
python -m pytest -v                    # verbose, one line per test
python -m pytest tests/test_workflow.py  # a single file
python -m pytest --cov=app --cov-report=term-missing  # with coverage
```

Requires a working `DATABASE_URL` in `api/.env` pointing at a reachable Supabase project (the same one used for manual development) — see `api/.env.example`. **Run the suite serially** (see [above](#consequence-tests-must-run-serially-not-in-parallel)); do not run two invocations concurrently against the same database.

## How future contributors should add new tests

**Adding a test for an existing entity/action**: use the existing `make_venue`/`make_destination` factories and `client` fixture; follow the pattern in any existing test file (arrange with a factory, act via `client.post(...)`/`client.get(...)`, assert on both the HTTP response *and* the database row via `db.refresh(...)`).

**Adding a test for a new entity** (e.g. once Destinations gain their own workflow, or Media Library lands): add a `make_<entity>` factory fixture to `conftest.py` following the exact shape `make_destination`/`make_venue` already use — a closure that accepts `**overrides`, applies sane defaults, tracks created ids, and cleans them up in its `yield`-then-teardown block. This is deliberately the extensibility point the architecture review (Sprint 20 architecture review, prior to this sprint) called for: "avoid entity-specific assumptions where practical." The factory *pattern* is entity-agnostic even though today's two factories aren't — a third factory follows the same shape, it doesn't require changing the first two.

**Adding a test for a new global, cross-cutting table** (i.e., something like `publish_revisions`/`activity_log` that isn't owned by a single entity): extend `_clean_global_tables` with the same before/after watermark pattern rather than inventing a new cleanup mechanism.

**If a test reveals a real defect**: fix the application code, not the test — this sprint's instruction was explicit that "Do not change application behavior unless a test reveals a real defect." No such defect was found while writing this suite (see the Sprint 20 `ROADMAP.md` entry for the full verification run).

## Frontend testing strategy

**Scope for this sprint**: infrastructure only, per instruction ("Do not attempt broad UI coverage in this sprint"). Vitest (chosen since the project already uses Vite — no second bundler/config to maintain) plus React Testing Library and `jsdom` are wired up, with exactly one smoke test proving the setup works end-to-end (a real component render, in a real DOM environment, with `@testing-library/jest-dom`'s matchers available).

### Directory structure

```
datalab-next/
├── vite.config.ts              # extended with a `test` block (environment: jsdom, setupFiles)
├── package.json                 # "test": "vitest run", "test:watch": "vitest"
└── src/
    ├── test/
    │   └── setup.ts              # imports @testing-library/jest-dom/vitest — one line, shared by every test file
    └── components/
        └── StatusBadge.test.tsx  # the one smoke test this sprint adds
```

Co-locating a component's test next to the component itself (`StatusBadge.tsx` / `StatusBadge.test.tsx`) is the intended convention going forward — Vitest picks up any `*.test.tsx`/`*.test.ts` file under `src/` automatically, no per-file registration needed.

### How to run the frontend tests

```bash
cd datalab-next
npm install   # once, to pick up the new devDependencies (vitest, @testing-library/react, @testing-library/jest-dom, jsdom)

npm run test        # run once, exit
npm run test:watch  # watch mode, for active development
```

### How future contributors should add new tests

Add a `<Component>.test.tsx` next to the component it tests, following `StatusBadge.test.tsx`'s shape: `render()` the component, then assert against `screen` queries. For anything that depends on TanStack Query (nearly every stateful component in this codebase) or React Router, wrap the render in the relevant provider(s) — neither is wired into the shared test setup yet, since the one smoke test added this sprint deliberately didn't need them. The first test that does need a `QueryClientProvider` is the natural trigger to add a small shared test-utils render helper (e.g. `src/test/renderWithProviders.tsx`) — not built preemptively here, per this sprint's "infrastructure, not new features" framing.

## Known limitations and honest trade-offs

- **~~Shared database, not a dedicated test database.~~ RESOLVED.** This was the suite's most serious limitation and it caused a real incident (see [above](#the-test-database-is-isolated-and-the-isolation-is-enforced-in-code)). The suite now runs against a disposable Postgres selected by `TEST_DATABASE_URL`, with a guard that refuses managed-provider hosts outright. The convention-based *intra-run* isolation (test-prefixed ids, self-cleaning fixtures, the global-table watermark) is still in place and still worth keeping — it is what lets one local database be reused across runs without a reset — but it is no longer the only thing standing between a test run and production data.
- **No CI wiring yet.** These tests run locally, on demand. Wiring `pytest`/`vitest` into a CI pipeline (GitHub Actions or similar) — including making the database-access trade-off above a CI-time decision, not just a local one — is future work, not part of this sprint.
- **Coverage is backend-only.** `pytest-cov` reports on `api/app/`; there is no frontend coverage tooling configured yet (Vitest supports `@vitest/coverage-v8` — not added this sprint, since one smoke test doesn't need a coverage report to be meaningful).
