# Phase 2 Completion Report — Backend API

**Source of truth:** `docs/PLATFORM_SPEC_v1.0_FROZEN.md`,
`docs/IMPLEMENTATION_BACKLOG.md`. Neither document was modified. Phase 1's
migrations were not touched — no functional defect was found in them.

---

## Epics completed

| Epic | Objective | Status |
|---|---|---|
| **EP8** — Venue Lifecycle Completion | `POST /editor/venues`, `DELETE .../media`, reserved-id validation | ✅ Complete |
| **EP9** — Destination Workflow Parity & Boundary Write Path | boundary write, submit/approve/reject, stats endpoint | ✅ Complete |
| **EP10** — Beach Write Path | `beach_details` writable via `PATCH`, at create and update | ✅ Complete |
| **EP11** — Reject Workflow | reason-required Reject, venues + destinations | ✅ Complete |
| **EP12** — Referential Closure Enforcement | approve-time gate + publish-time filter + exclusion logging | ✅ Complete |
| **EP13** — Concurrency Protocol | ETag/If-Match for venues + destinations, 428/409 | ✅ Complete |
| **EP14** — Statistics & Export Endpoints | `GET /editor/stats`, venue/destination export (csv/json) | ✅ Complete |
| **EP15** — Bulk Endpoint Unification | `bulk/category` + `bulk/destination` → one `PATCH /bulk` | ✅ Complete |
| **EP16** — API Versioning Declaration | `API-Version: v1` header, documented v2 policy | ✅ Complete |

All 9 Phase 2 epics complete. No epic was deferred.

---

## Tasks completed

Every task listed under EP8–EP16 in `IMPLEMENTATION_BACKLOG.md`, including
the ones with Frontend touch-points in the backlog's own table — those are
explicitly **not** implemented here (Studio is Phase 3), only the backend
half of each task. No frontend code was touched.

---

## Endpoints implemented

| Method | Path | Epic |
|---|---|---|
| `POST` | `/editor/venues` | EP8 |
| `GET` | `/editor/venues/export` | EP14 |
| `DELETE` | `/editor/venues/{id}/media` | EP8 |
| `POST` | `/editor/venues/{id}/reject` | EP11 |
| `PATCH` | `/editor/venues/bulk` (replaces `bulk/category`, `bulk/destination`) | EP15 |
| `GET` | `/editor/destinations/export` | EP14 |
| `GET` | `/editor/destinations/{id}/stats` | EP9 |
| `POST` | `/editor/destinations/{id}/submit-for-review` | EP9 |
| `POST` | `/editor/destinations/{id}/approve` | EP9 |
| `POST` | `/editor/destinations/{id}/reject` | EP11 |
| `GET` | `/editor/stats` | EP14 |

**Modified (existing endpoints, extended contract):**

| Method | Path | Change |
|---|---|---|
| `PATCH` | `/editor/venues/{id}` | Requires `If-Match` (EP13); accepts `beach_details` (EP10) |
| `PATCH` | `/editor/destinations/{id}` | Requires `If-Match` (EP13); accepts `boundary` (EP9), validates `region` (EP9) |
| `GET` | `/editor/venues/{id}`, `/editor/destinations/{id}` | Returns `ETag` header (EP13) |
| `POST` | `/editor/venues/{id}/approve` | New gate: 422 `destination_not_approved` if destination isn't `approved` (EP12) |
| `POST` | `/editor/publish` | Response gains `excluded_venue_count` (EP12) |
| `POST` | `/editor/destinations` | Reserved-id check (EP8/§7.7); region validated at API layer, not just DB (EP9) |

**Removed:** `PATCH /editor/venues/bulk/category`, `PATCH /editor/venues/bulk/destination` — replaced by the unified `PATCH /editor/venues/bulk` (EP15). No external consumer exists yet (Studio is Phase 3), so this is a clean removal, not a deprecation.

---

## Validation rules added

- Venue creation: reserved id (§7.7), duplicate id (409), unknown destination (404), category must be one of 13 (422), `beach_details` shape when `category='Beach'` (422).
- Venue update: `beach_details` shape checked against the venue's *resulting* category (current or incoming, whichever the payload implies) — a single call may change both at once.
- Destination creation/update: `region` validated against the 8-value set at the API layer (previously DB-only, surfacing as a raw `IntegrityError`).
- Destination update: `boundary` must be a GeoJSON `Polygon`/`MultiPolygon` with a `coordinates` key (key-presence/type check, not deep geometry validation — same practical limit as `beach_details`).
- Reject (both entities): `reason` non-blank, enforced by `RejectRequest`'s `min_length=1`.
- Bulk update: at least one of `category`/`destination_id` must be present (422 `no_fields_to_update`).
- Approve (venue): destination must be `approved` (422 `destination_not_approved`) — the referential-closure prevention gate.

## Authentication changes

**None to the authentication mechanism itself.** `require_permission`'s existing role map is reused unchanged — every new endpoint depends on the same `Permission` enum values already in use (`CONTENT_VIEW`, `CONTENT_EDIT`, `CONTENT_SUBMIT_REVIEW`, `CONTENT_APPROVE`). The one new authorization-adjacent behavior is the concurrency protocol (EP13), which is a precondition check, not an auth check — a request that fails `If-Match` is still authenticated and authorized, just rejected for referencing a stale version.

---

## Files changed

**New:**
- `api/app/api/concurrency.py`, `api/app/api/identifiers.py`, `api/app/api/routes/stats.py`
- `api/app/validation/destinations.py`
- `api/tests/test_venue_creation.py`, `test_destination_parity.py`, `test_venue_workflow_extensions.py`, `test_referential_closure.py`, `test_concurrency.py`, `test_stats_and_export.py`

**Modified:**
- `api/app/api/routes/venues.py`, `api/app/api/routes/destinations.py`, `api/app/api/router.py`
- `api/app/api/schemas.py`
- `api/app/media/service.py` (added `delete_image`)
- `api/app/publishing/engine.py` (referential-closure rewrite)
- `api/app/validation/venues.py` (added `validate_beach_details_shape`)
- `api/app/workflow/transitions.py` (type hint widened, see below)
- `api/app/main.py` (API-Version header, CORS `If-Match`/`ETag`)
- `api/tests/test_bulk_operations.py`, `test_cors.py`, `test_destination_media.py`, `test_destinations.py`, `test_media.py`, `test_permissions.py` (mechanical fixes for EP13/EP15, detailed below)

**Schema/migrations:** none. Phase 2 is backend-API-only, per its own scope; every column it needed already exists from Phase 1.

---

## A note on scope discipline during this phase

One pre-existing detail surfaced while implementing EP9: `app/workflow/transitions.py`'s `require_status()` was always documented as *"deliberately generic — not Venue-specific,"* but was still typed `venue: Venue`. Using it for destinations (as EP9 requires) needed that type hint widened to a small `Protocol` (`_HasStatus`). This is a type-hint correction matching the function's own long-standing stated intent, not a redesign — confirmed no behavior change, and confirmed no test depends on the old generic 409 message's exact wording ("Venue is in..." → "Resource is in...").

No other completed-Phase-1 file was touched, and no Phase 1 migration was modified — nothing in this phase constituted or required a functional defect finding against Phase 1.

---

## Test summary

**Full migration chain:** clean `alembic upgrade head` from an empty database (0001→0010) — verified on a fresh Postgres container, not just the one already used during development.

**Full test suite: 308 / 308 passing.**

| Category | Count |
|---|---|
| Pre-Phase-2 baseline (233 original + 16 Phase 1 schema tests) | 249 |
| New Phase 2 tests (6 new files) | 56 |
| Appended to existing files (`test_bulk_operations.py`, `test_cors.py`) | 3 |
| **Total** | **308** |

**Existing tests fixed, not weakened**, to match two deliberate, spec-mandated contract changes:
- **EP13's mandatory `If-Match`**: every existing `PATCH /editor/venues/{id}` / `PATCH /editor/destinations/{id}` call across `test_cors.py`, `test_destination_media.py`, `test_destinations.py`, `test_media.py`, `test_permissions.py` now sends `If-Match: <current version>`. Same test intent preserved in every case — none had its assertions loosened, only the request updated to satisfy the new required header (identical in kind to Phase 1's region-literal fixes).
- **EP15's endpoint unification**: `test_bulk_operations.py`'s category/destination URLs updated from the two removed endpoints to the one that replaced them.

**One test-authoring mistake caught before it became a real defect**: an initial destination-readiness test tried to construct a `Destination` row with `region=""` directly against the database — Phase 1's `ck_destinations_region` CHECK constraint now makes that state genuinely impossible to create at all (not just application-rejected), so the test was rewritten to exercise the still-reachable half of the same validation gate (`name=""`) instead. Caught and fixed during this phase's own test-writing, not left in.

---

## Risks

- **`region`'s API-layer validation error path is new and not yet load-tested against a real client** — Studio (Phase 3) is the first real caller of the create/update endpoints with this check active; low risk, but worth confirming in Phase 3's own verification pass.
- **`delete_image()`'s "not a URL this service produced → silent no-op" behavior** is by design (matches the legacy tool's own idempotent-delete precedent) but means a hand-pasted `cover_image_url` (still possible via `PATCH`) will appear "deleted" from the venue's perspective without any actual storage cleanup — acceptable, since nothing in this platform's storage was ever at risk, but worth Studio (Phase 3) being aware of if it ever surfaces a "deleted" confirmation to an editor.
- **CSV export's handling of nested fields** (`dict`/`list` columns like `gallery_image_urls`, `opening_hours`) stringifies them with Python's default `str()` representation rather than a structured sub-format — acceptable for a first version of Export, worth revisiting if CSV becomes the primary consumption path rather than JSON.
- **The unified bulk endpoint has no existing external consumer to break** (Studio's Phase 3 build will be the first) — the clean removal of the two old endpoints carries no compatibility risk today, but would if this were done after Phase 3 shipped a caller against the old shape.

## Deferred items

None within Phase 2's own scope. Every backlog task's Frontend/Studio half is deferred to Phase 3 by the backlog's own phase boundary, not by a decision made during this phase — consistent with `IMPLEMENTATION_BACKLOG.md`'s explicit "Phase 3, matched one-for-one against whichever Phase 2 epic each Studio epic depends on" sequencing.

---

## Phase Review

- **API contract compliance:** every new/changed endpoint matches its backlog acceptance criteria, verified by dedicated tests, not just manual inspection.
- **Authentication and authorization:** unchanged mechanism, reused correctly on every new route; verified by `as_role`/`_authenticated_by_default` coverage in the new test files (viewer-cannot-X cases present for create, reject, and bulk).
- **Validation rules:** each new rule has both a passing and a failing test case.
- **Error handling:** every new rejection path returns a structured `{error, message}` (or richer) detail, consistent with the codebase's existing convention — no raw `IntegrityError` reaches a client for any new write path.
- **Response schema:** every new/changed schema field verified via direct assertion in tests, not just declared.
- **No duplicated logic:** the referential-closure gate's logic lives in exactly one place (`_approve_or_raise`); the concurrency protocol's logic lives in exactly one shared module (`app/api/concurrency.py`), used identically by both entities; `check_reserved_id` likewise shared, not reimplemented per entity.
- **No dead code:** confirmed via `ruff`'s `F401` (unused import) check — zero findings across every new/changed file.
- **No TODO/FIXME/HACK:** checked directly, none found.
- **No debug statements:** checked directly, none found.
- **No regressions:** 308/308 passing, including every pre-existing test, verified on a clean-slate database.

---

## Ready for Phase 3: **YES**

Every Studio-facing endpoint Phase 3 needs already exists and is tested:
publish/rollback (already existed, now with `excluded_venue_count`),
venue creation, beach fields, export, image delete, destination
boundary/workflow/stats, and the concurrency protocol's backend half. The
one thing Phase 3 must ship in the same release as any Studio `PATCH`
call is the `If-Match` client-side handling — per
`IMPLEMENTATION_BACKLOG.md`'s own Blockers section (EP13/EP22 must ship
together), not a new constraint introduced here.

**Not beginning Phase 3. Awaiting review.**
