# Phase 3 Completion Report — Studio (DataLab Frontend)

**Source of truth:** `docs/PLATFORM_SPEC_v1.0_FROZEN.md`,
`docs/IMPLEMENTATION_BACKLOG.md`, `docs/PHASE1_COMPLETION_REPORT.md`,
`docs/PHASE2_COMPLETION_REPORT.md`. None of the frozen documents were
modified. Production architecture, backend contracts, database schema,
and API behavior remained frozen throughout — the two schema-level
changes made (see "Backend bug found and fixed" below) are additive
field-level corrections to Phase 2's own already-approved contract, not
redesigns, and neither removes nor changes any existing endpoint,
column, or response field.

---

## Epics completed

| Epic | Objective | Status |
|---|---|---|
| **EP17** — Publish & Rollback Controls | Publish button + confirmation; Republish (already existed) | ✅ Complete |
| **EP18** — Dashboard Statistics | Replace placeholder with live `GET /editor/stats` tiles | ✅ Complete |
| **EP19** — Venue Create Form & Beach Fields | `POST /editor/venues` form; conditional beach fields | ✅ Complete |
| **EP20** — Export & Image Delete UI | Export (CSV/JSON); real media delete via storage-backed endpoint | ✅ Complete |
| **EP21** — Reject Reason UI | Reason-required Reject for venues and destinations | ✅ Complete |
| **EP22** — Concurrency Client Integration | `version`/`If-Match` on every entity `PATCH`; 409 handling | ✅ Complete |
| **EP23** — Translations Editing (Minimal) | Optional Arabic name field, `translations.ar.name` | ✅ Complete |

All 7 Phase 3 epics complete. No epic was deferred. Followed the
backlog's own listed order (EP17 → EP23), one commit per epic.

---

## What was implemented, epic by epic

### EP17 — Publish & Rollback Controls
Republish already existed on the revision detail view from an earlier
sprint; the only missing piece was Publish itself. Added a confirmation
dialog (native `<dialog>`, the pattern `DestinationCreateDialog` already
established) calling the existing `POST /editor/publish`, gated on
`content_publish`, surfacing `excluded_venue_count` (EP12's
referential-closure exclusion count) when nonzero.

### EP18 — Dashboard Statistics
Replaced `Dashboard.tsx`'s static welcome placeholder with 7 live stat
tiles consuming `GET /editor/stats`.

### EP19 — Venue Create Form & Beach Fields
Added a "New Venue" dialog (`POST /editor/venues`) with the 13-value
category select, and conditional `beach_details` fields (`type`,
`publicAccess`) shown only when `category === 'Beach'`, both at creation
and in the existing venue editor.

### EP20 — Export & Image Delete UI
Added Export (CSV/JSON) buttons for both venues and destinations,
consuming `GET .../export` via a new authenticated-download helper.
Switched cover/gallery image removal from a plain `PATCH` (which only
unlinked the URL) to `DELETE .../media`, so the stored file is actually
deleted, not orphaned.

### EP21 — Reject Reason UI
Added a shared `RejectDialog` (reason required, `review → draft`) for
both venues and destinations, gated the same way Approve already is
(`content_approve` + `status === 'review'`).

### EP22 — Concurrency Client Integration
Added `version` to the frontend `Venue`/`Destination` types, sent
`If-Match: <version>` on every entity `PATCH`, and added a conflict
banner (backend's own descriptive message + a Reload control) on `409`.
This closed a real, live gap: Phase 2's EP13 already required `If-Match`
on every `PATCH /editor/venues/{id}` and `PATCH /editor/destinations/{id}`
in production, and Studio had no support for it at all — every Save
Draft, gallery reorder, and cover-clear call was silently broken
(`428 Precondition Required`) until this epic landed.

### EP23 — Translations Editing (Minimal)
Added an optional "Arabic Name" field to both venue and destination edit
forms, round-tripping `translations.ar.name`.

---

## Backend bug found and fixed

**`VenueUpdate`/`DestinationUpdate` never accepted `translations`.**
While implementing EP23, inspection of `api/app/api/schemas.py` showed
`translations` was present on both `Out` schemas (readable, since Phase 1)
but absent from both `Update` schemas — meaning `PATCH` silently ignored
any `translations` value a caller sent. This directly contradicted
`IMPLEMENTATION_BACKLOG.md`'s own EP23-T01 acceptance criterion
("`PATCH` accepts `translations`") and PLATFORM_SPEC_v1.0_FROZEN.md §5's
i18n design, which specifies `translations` as writable columns, not
read-only ones.

This was treated as a genuine backend defect (an omission from Phase 2's
schema work, not a deliberate design decision) rather than a redesign —
per the operating rule "do not change endpoints unless an actual backend
bug is discovered." The fix is a strict, additive, one-field-per-schema
change:

- `api/app/api/schemas.py`: added `translations: dict | None = None` to
  both `VenueUpdate` and `DestinationUpdate`, matching the exact pattern
  every other optional field in those schemas already uses.
- No route logic changed — `update_venue`/`update_destination` already
  iterate `payload.model_dump(exclude_unset=True)` generically, so the
  new field required zero additional plumbing.
- Added one round-trip test per entity (`test_venue_workflow_extensions.py`,
  `test_destinations.py`), verifying `PATCH` persists and returns
  `translations.ar.name` verbatim.

**Also fixed (frontend-only, tied to already-shipped Phase 2 contracts):**

- `venueCategories.ts` was stale against Phase 1's 13-value category
  CHECK constraint (missing Resort, Spa, Beach Club, Activity) — found
  while building EP19's category select, which needed the full,
  accurate list to meet its own acceptance criterion.
- `bulkUpdateVenueCategory`/`bulkUpdateVenueDestination` were still
  calling `/editor/venues/bulk/category` and `/bulk/destination` — both
  endpoints Phase 2's EP15 removed in favor of the unified
  `PATCH /editor/venues/bulk`. These calls were 404ing in the current
  build; fixed to hit the unified endpoint, exactly the frontend
  adaptation EP15-T01's own backlog row already calls for
  ("Studio bulk-action calls updated to the new endpoint").
- Venue image removal (cover/gallery) was going through a plain `PATCH`
  that cleared the URL reference without ever deleting the underlying
  file from storage — fixed as part of EP20 to use the real
  `DELETE .../media` endpoint, which does both.

No other contradiction was found between the frozen spec, the backlog,
and the existing Studio codebase.

---

## Files changed

**New (frontend):**
- `features/publishing/{usePublish,PublishButton}.ts(x)`
- `features/stats/{types,api,usePlatformStats,StatTile}.ts(x)`
- `features/venues/{VenueCreateDialog,useCreateVenue,useDeleteVenueMedia,useRejectVenue}.ts(x)`
- `features/venues/workspace/sections/BeachDetailsSection.tsx`
- `features/destinations/useRejectDestination.ts`
- `components/{ExportButton,RejectDialog}.tsx`

**Modified (frontend):**
- `lib/apiClient.ts` (`apiDeleteJson`, `apiDownload`, `apiPatch` gains
  optional `extraHeaders`)
- `types/{venue,destination}.ts` (`version`, `translations`)
- `features/publishing/{api,types}.ts`
- `features/venues/{api,useUpdateVenue,venueCategories}.ts`
- `features/venues/workspace/{VenueWorkspace,WorkspaceToolbar}.tsx`
- `features/venues/workspace/sections/BasicInfoSection.tsx`
- `features/destinations/{api,useUpdateDestination}.ts`
- `features/destinations/workspace/DestinationWorkspace.tsx`
- `features/destinations/workspace/sections/BasicInfoSection.tsx`
- `pages/{Dashboard,Publishing,Venues,Destinations}.tsx`

**Modified (backend):**
- `api/app/api/schemas.py` (`translations` on `VenueUpdate`/`DestinationUpdate`)
- `api/tests/{test_destinations,test_venue_workflow_extensions}.py`
  (translations round-trip tests)

**Schema/migrations:** none. Phase 1 already added the `translations`
column; Phase 3 only exposed the existing column as writable at the API
layer and consumed it in Studio.

---

## Frontend/backend consumption checklist (per the kickoff's explicit requirements)

- **Optimistic concurrency (ETag/If-Match):** implemented (EP22) — every
  entity `PATCH` sends `If-Match`; `409` is handled with a
  reload-and-discard control, not a silent failure or overwrite.
- **Backend validation:** not bypassed anywhere. Category, beach-details
  shape, boundary shape, region, and reject-reason validation all remain
  server-side; the frontend's own field-level checks (e.g. requiring a
  beach type before submit) exist only to avoid an always-invalid round
  trip, never to replace the backend's own gate.
- **Backend error responses:** every new mutation surfaces the backend's
  structured `{error, message}` detail via the existing `ApiError`/
  `extractErrorMessage` machinery — no new ad hoc error handling was
  introduced.
- **Publish workflow:** implemented (EP17) — Publish and Republish are
  both now reachable from the UI, both surfacing the backend's real
  response (including `excluded_venue_count`).
- **Authentication:** unchanged — every new call goes through the
  existing `apiClient.ts` Bearer-token path; no new auth mechanism was
  introduced.
- **Permissions:** every new control is gated with the existing
  `hasPermission(role, permission)` helper, matching exactly the
  permission the backend's own `require_permission(...)` already
  enforces for that endpoint (`content_edit` for create/media-delete,
  `content_publish` for Publish, `content_approve` for Reject).

---

## Tests executed

**Backend:** fresh Postgres 16 container, clean `alembic upgrade head`
from empty (0001 → 0010), full suite: **310/310 passing**
(308 pre-Phase-3 + 2 new `translations` round-trip tests). `ruff check`
on every file touched this phase: clean (the 91 pre-existing `B008`
findings in untouched route files are Phase 2's own documented baseline
— FastAPI's standard `Depends(...)` pattern, not a new issue).

**Frontend:** `tsc -b` (project-wide type check): clean. `oxlint`: zero
findings. `vitest run`: 2/2 passing (no new frontend unit tests were
needed this phase — every new piece is either a thin API-consuming hook,
already covered indirectly by the backend's own contract tests, or UI
wiring with no existing test-authoring convention to extend, same as
`RevisionDetail`'s own Republish control before it). Production build
(`vite build`): succeeds; one pre-existing bundle-size advisory
(>500 kB, unrelated to this phase's work, not a new regression).

**Browser verification:** blocked by Supabase login — no test
credentials were available in this session to authenticate into Studio,
so no live screenshot/interaction verification was performed beyond
type-checking, linting, and the automated test suites above. This is a
real limitation of this session, not a claim of visual correctness.

---

## Production readiness audit

Searched the entire `datalab-next/src` tree and the backend `api/app`
tree for:

| Pattern | Result |
|---|---|
| Dead code | None found introduced by Phase 3 |
| `TODO` | None |
| `FIXME` | None |
| `HACK` | None |
| `console.log` / `console.debug` | None |
| `debugger` | None |
| Unused imports | None (`oxlint` clean; `ruff` clean on touched files) |

No temporary code, feature flags, or backwards-compatibility shims were
introduced anywhere in Phase 3.

---

## Risks / known limitations

- **No browser-verified visual/interaction proof** for any Phase 3 UI
  (see "Tests executed" above) — the automated gates (type check, lint,
  test suite, production build) all pass, but this is not a substitute
  for an actual login-and-click pass. Recommended before this ships to
  real users: a manual smoke pass through Publish, Venue create with
  beach fields, Export, Reject, a real concurrent-edit conflict, and the
  Arabic name field.
- **`translations` editing is genuinely minimal**, exactly as EP23 scoped
  it — one locale (`ar`), one field (`name`), no locale picker, no
  validation beyond "optional." Extending i18n further is out of this
  phase's scope by design.
- **The EP22 conflict UX is a blunt "Reload" (discard-and-refetch)**, not
  a merge or diff view — acceptable for a first version per the
  backlog's own acceptance criterion ("no silent data loss"), but a
  editor with substantial unsaved edits will lose them on conflict, same
  as before this epic in spirit (the difference is now they're told,
  rather than the request silently 428ing with no explanation).

## Deferred items

None within Phase 3's own scope (EP17–EP23). Two adjacent gaps were
noticed but deliberately **not** addressed, since they belong to epics
outside Phase 3's defined list, not to any epic actually assigned here:

- Destination workflow UI (Submit for Review / Approve buttons, and the
  `GET /editor/destinations/{id}/stats` display) — EP9's frontend
  touch-points, but no Phase 3 epic covers building this UI; only Reject
  (EP21) was in scope for destinations' workflow.
- Bundle-size optimization (code-splitting) — a pre-existing build
  advisory, unrelated to any Phase 3 requirement.

---

## Phase Review

- **API contract compliance:** every new UI control calls an endpoint
  that already existed and was already tested server-side (Phase 2); no
  endpoint was changed except the one additive, spec-aligned field fix
  described above.
- **Authentication and authorization:** unchanged mechanism; every new
  control's visibility matches the backend's own permission requirement.
- **No redesign:** confirmed — no existing page layout, styling
  convention, or component pattern was replaced; new controls follow
  established patterns (native `<dialog>`, `WorkspaceSection`/
  `WorkspaceField`, `hasPermission` gating) rather than introducing new
  ones.
- **No opportunistic scope expansion:** the venueCategories fix, the
  bulk-endpoint fix, and the image-delete-via-storage fix were each
  discovered as a direct blocker to the epic being implemented at the
  time (EP19, EP20, EP20 respectively) — not unrelated cleanup.
- **No dead code, TODO/FIXME/HACK, or debug statements:** confirmed via
  direct search, see audit table above.
- **No regressions:** 310/310 backend tests passing, 2/2 frontend tests
  passing, clean type-check/lint/build across both.

---

## Ready for Phase 4 (or beyond): review recommended before proceeding

Per this phase's explicit instruction: **do not continue beyond Phase 3.**
Stopping here. A manual browser smoke pass (see Risks above) is
recommended before this is considered fully production-verified, since
this session could not authenticate into Studio to perform one.
