# Phase 1 Completion Report — Schema & Database

**Source of truth:** `docs/PLATFORM_SPEC_v1.0_FROZEN.md`,
`docs/IMPLEMENTATION_BACKLOG.md`. Neither document was modified during this
implementation.

---

## Epics completed

| Epic | Objective | Status |
|---|---|---|
| **EP1** — Category Taxonomy Extension | Extend `venues.category` to the frozen spec's 13 values | ✅ Complete |
| **EP2** — Region Enforcement | Constrain `destinations.region` to 8 named values | ✅ Complete (schema); `EP2-T02`'s API/Studio dropdown deferred — see below |
| **EP3** — Optimistic Concurrency Columns | Add `version` to `venues`/`destinations` | ✅ Complete (schema only, per its own scope — protocol is Phase 2's EP13) |
| **EP4** — Internationalization Columns | Add `translations` to `venues`/`destinations` | ✅ Complete, **plus a corrected gap**: `venues.legacy_geo` (see below) |
| **EP5** — Beach Details Integrity Constraint | DB-enforce `beach_details`' shape | ✅ Complete, **plus a real bug found and fixed** (see below) |
| **EP6** — Publish Revision Schema Cleanup | Drop `destination_count`/`venue_count` | ⏸️ **Deferred, per the backlog's own documented blocker** — see below |
| **EP7** — Required Indexes | All named indexes + `pg_trgm` | ✅ Complete |

## Tasks completed

All tasks under EP1, EP3, EP4, EP5, EP7 (every task listed in
`IMPLEMENTATION_BACKLOG.md`). EP2-T01 (the CHECK constraint) is complete;
EP2-T02 (API/Studio dropdown) is out of scope for this phase — it requires
touching `app/api/schemas.py` and the Studio frontend, which is Phase 2/3
work by the backlog's own field breakdown, not "Schema & Database."

---

## A contradiction found between the two frozen documents — resolved with your sign-off, not invented

Before touching any code, I found that `venues.legacy_geo` is required by
`PLATFORM_SPEC_v1_FINAL.md` §2.2 (Venue entity table) and
`PLATFORM_SPEC_v1.0_FROZEN.md` §7.13 (drop-eligibility condition), but has
**no corresponding
creation task anywhere in `IMPLEMENTATION_BACKLOG.md`** — only a task that
writes data *into* it (Phase 5's `EP27-T04`) and one that tracks its later
*removal* (Phase 7's `EP38`), both presupposing it already exists. I stopped,
explained the exact gap and cited both documents' exact sections, and asked
how to proceed rather than guessing. You approved adding it to EP4. It is now
implemented (migration `0008`) and explicitly documented in this report and
in the migration's own docstring as a corrected backlog omission, not a
specification change.

## A real bug found and fixed during EP5's own verification

Testing `beach_details`' shape constraint surfaced a genuine correctness gap,
not a test artifact: SQLAlchemy's `JSONB` type defaults `none_as_null` to
`False`, so an explicit Python `None` assigned to a JSONB column binds as the
**JSON `null` literal**, not SQL `NULL`. This is invisible for every other
JSONB column in this schema, but directly breaks
`ck_venues_beach_details_shape`'s `beach_details IS NULL OR (...)` clause —
ordinary application code that clears `beach_details` (e.g., an editor
switching a venue's category away from `Beach`) would store JSON `null` and
spuriously fail the constraint. Fixed by setting `JSONB(none_as_null=True)`
on `beach_details` specifically — scoped to the one column where it's
load-bearing, not applied to every JSONB column speculatively.

## EP6 — deliberately deferred, per the backlog's own documented rule

`IMPLEMENTATION_BACKLOG.md`'s own Blockers section states: *"EP6 (drop
revision counts) cannot start before EP25 is deployed and verified."* EP25
(the read-time `jsonb_array_length` replacement) is Phase 4 work, not yet
implemented. Dropping the columns now would break the revision-list endpoint
with no replacement live — I did not implement EP6, and `PublishRevision`'s
`destination_count`/`venue_count` columns are untouched. This is not a new
decision; it is following a sequencing rule I already documented in the
backlog itself, now honored during execution rather than overridden for
convenience.

## EP2-T02 — deferred, scope boundary

`EP2-T02` (reject invalid region at the API layer, replace the Studio region
input with a dropdown) has `Frontend` and `API` fields in its own backlog
row — it is not a database task. Implementing it here would exceed "Phase 1
— Schema & Database" as scoped by your instruction. The database-level
enforcement (`EP2-T01`) is complete and is the actual safety net; an invalid
`region` value sent via the API today will surface as a raw `500` from an
uncaught `IntegrityError` rather than a clean `422` until Phase 2 adds
`EP2-T02`'s validation layer. Flagging this explicitly as a known, temporary
rough edge — not a silent gap.

---

## Files changed

**New — Alembic migrations (`api/alembic/versions/`):**
- `0005_venue_category_extension.py`
- `0006_destination_region_check.py`
- `0007_concurrency_version_columns.py`
- `0008_i18n_and_legacy_geo_columns.py`
- `0009_beach_details_shape_constraint.py`
- `0010_required_indexes.py`

**New — test suite:**
- `api/tests/test_schema_constraints.py`

**Modified:**
- `api/app/db/models.py` — `VENUE_CATEGORIES` (13 values),
  `DESTINATION_REGIONS` (new), `Destination`/`Venue.version`,
  `Destination`/`Venue.translations`, `Venue.legacy_geo`, `Venue.beach_details`
  (CHECK + `none_as_null=True`), 6 new `Index` declarations.
- `api/tests/conftest.py` — `make_destination`'s default region
  (`"Test Region"` → `"Marina"`), required by EP2.
- `api/tests/test_destinations.py` — 5 hardcoded free-text region values
  replaced with values from the enforced 8-value set, same test intent
  preserved.

## Database changes

| Change | Migration |
|---|---|
| `ck_venues_category` widened to 13 values | `0005` |
| `ck_destinations_region` (new, 8 values) | `0006` |
| `venues.version`, `destinations.version` (int, default 1) | `0007` |
| `venues.translations`, `destinations.translations` (JSONB, nullable) | `0008` |
| `venues.legacy_geo` (JSONB, nullable) | `0008` |
| `ck_venues_beach_details_shape` (new CHECK) | `0009` |
| `ix_venues_category`, `ix_venues_status`, `ix_venues_destination_id_status`, `ix_destinations_status`, `ix_publish_revisions_published_at` (new B-tree/composite) | `0010` |
| `pg_trgm` extension + `ix_venues_name_trgm` (GIN, trigram on `lower(name)`) | `0010` |

`ix_venues_destination_id` was **not** recreated — confirmed already present
from `0001_initial_schema.py` before writing `0010`.

## Migrations created

6 (`0005`–`0010`), chained `0004 → 0010`. Verified:
- Full `alembic upgrade head` from empty, clean.
- Full `alembic downgrade base` back to empty, clean.
- Re-`upgrade head` after full downgrade, clean (genuine reversibility, not
  just forward-only).

## Test results

- **249 / 249 passing** (233 pre-existing + 16 new), run against a real,
  disposable Postgres 16 container from a clean `alembic upgrade head`.
- Every new constraint verified both by direct SQL/ORM insertion (all 13
  categories, all 8 regions, both rejection cases) and by the new pytest
  suite (`test_schema_constraints.py`).
- Trigram index confirmed actually used by the query planner
  (`EXPLAIN` shows a Bitmap Index Scan on `ix_venues_name_trgm` for the
  existing `ILIKE '%...%'` search pattern), not just present.
- No formatter/linter/type-checker is part of this project's configured
  toolchain (no `pyproject.toml`/`ruff.toml`, nothing in
  `requirements-dev.txt`). Ran `ruff` as a best-effort check anyway (it
  happened to be installed from earlier ad hoc use this session) — every
  finding on changed files matches an identical, pre-existing pattern
  already present in migrations `0001`–`0004` or in `models.py` before this
  phase, confirmed by diffing against the committed baseline. No new lint
  debt introduced; no pre-existing debt fixed either, per the no-opportunistic-
  refactoring rule.

## Risks

- **Region validation currently fails ungracefully at the API layer**
  (raw `500` instead of `422`) until Phase 2's `EP2-T02` lands — narrow,
  known, and named above, not hidden.
- **Indexes were created with plain `CREATE INDEX`, not `CONCURRENTLY`** —
  acceptable at current near-empty production data volume, but Phase 7's
  `EP35` must use `CONCURRENTLY` if these are ever rebuilt against a live
  table with real write traffic (already noted in migration `0010`'s own
  docstring).
- **`beach_details`' `none_as_null` fix is scoped to one column.** Other
  JSONB columns (`opening_hours`, `translations`, `boundary`, `legacy_geo`)
  have the same underlying None-vs-null ambiguity, but none of them currently
  have a CHECK constraint that depends on the distinction, so none required
  the same fix. Worth remembering if a future constraint is added to any of
  them.

## Deferred items

| Item | Justification |
|---|---|
| **EP6** (drop `destination_count`/`venue_count`) | Backlog's own documented blocker: must follow Phase 4's `EP25`, not precede it |
| **EP2-T02** (API/Studio region dropdown) | Genuinely Phase 2/3 scope (API + Frontend columns in the backlog), not "Schema & Database" |

Both are pre-existing, already-documented sequencing decisions from the
backlog itself — neither is a new gap discovered or invented during this
phase.

---

## Phase Review

- **No schema drift** — ORM (`models.py`) and migration history agree;
  verified by a clean-slate `alembic upgrade head` run matching the model
  definitions exactly.
- **No duplicated logic** — the taxonomy/region value lists live once, in
  `models.py`, imported by their respective migrations, not restated.
- **No unused code** — every new column, constraint, and index is exercised
  by at least one test.
- **No TODO/FIXME/HACK markers** — checked directly across every changed
  file.
- **No debug statements** — checked directly (`print(`, `pdb`, `breakpoint`).
- **No failing tests** — 249/249, including a full clean-slate re-run.
- **No API regressions** — no route, schema, or endpoint behavior was
  touched in this phase; the one known rough edge (ungraceful region
  rejection) is a new constraint's side effect, not a regression of
  existing behavior.
- **Compliance with `PLATFORM_SPEC_v1.0_FROZEN.md`:** full, for every
  schema-level requirement in scope for this phase. Two items
  (`EP2-T02`, `EP6`) are correctly out of this phase's scope, not
  non-compliant — both are explicitly named above with their reasons.

---

## Ready for Phase 2: **YES**

Every Phase 1 schema dependency Phase 2 needs already exists: the 13-value
taxonomy (for the venue-create endpoint), the `version` columns (for the
concurrency protocol), `translations`/`legacy_geo` (for the migration
script's field mapping), and the referential-closure composite index (for
the publish-engine rewrite). The two deferred items are named, not hidden,
and neither blocks Phase 2 from starting.

**Not beginning Phase 2. Awaiting review.**
