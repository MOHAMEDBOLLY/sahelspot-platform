# Implementation Backlog — SahelSpot Platform v1.0

**Source of truth:** `docs/PLATFORM_SPEC_v1.0_FROZEN.md`. This backlog
converts that frozen specification into executable work. **It does not
change, reinterpret, or add to the specification** — every epic and task
below exists because a specific section of the frozen spec requires it, and
each task cites that section.

**No code, SQL, or migrations were written to produce this document.**

---

## How to read this document

- **38 Epics**, grouped into the 7 requested phases.
- Each Epic: Objective, Scope, Dependencies, Size (XS/S/M/L/XL), Risk,
  Acceptance Criteria.
- Each task: ID, Description, Backend/Database/API/Frontend/Tests/Docs
  touch-points (`—` means untouched), Depends on, Acceptance criteria.
- Task IDs: `EPn-Tnn`.
- §-references point to `PLATFORM_SPEC_v1.0_FROZEN.md`.

---

# PHASE 1 — Schema & Database

## EP1 — Category Taxonomy Extension

**Objective:** Make `venues.category`'s CHECK constraint match the frozen
13-value taxonomy (§3 of the frozen spec's referenced taxonomy section, and
supersedes the current 9-value constraint).
**Scope:** One constraint alteration; no data migration (no venue rows exist
in production with the four new values yet — those arrive in Phase 5).
**Dependencies:** None — this is a leaf, unblocked task.
**Size:** XS.
**Risk:** Very low. Purely additive to the legal-value set.
**Acceptance:** All 13 values insertable; every other string rejected; the
two rename mappings (`Café`→`Cafe`, `Service`→`Services`) require no schema
change since they normalize to existing values.

| ID | Description | Backend | DB | API | Frontend | Tests | Docs | Depends on | Acceptance |
|---|---|---|---|---|---|---|---|---|---|
| EP1-T01 | Alter `ck_venues_category` to the 13-value set | — | Alter CHECK constraint | — | — | Insert test per new value (4); reject test for an arbitrary 14th value | — | — | 13/13 accepted, all others rejected |
| EP1-T02 | Update category dropdown/filter options in Studio | — | — | — | Add 4 new options to venue category select | Component test: all 13 render, selection round-trips | — | EP1-T01 | Editor can select and save any of the 13 values |

---

## EP2 — Region Enforcement

**Objective:** Constrain `destinations.region` to the 8 named values (§7.3
of the frozen spec).
**Scope:** New CHECK constraint. No existing production destination violates
it (`marassi`'s `"Sidi Abdelrahman Area"` is in the set).
**Dependencies:** None.
**Size:** S.
**Risk:** Low — the risk is entirely in Phase 5 (24 new destinations must
each get one of the 8 values or be held out; that risk belongs to Phase 5,
not here).
**Acceptance:** Constraint enforces exactly the 8-value list; existing
`marassi` row unaffected.

| ID | Description | Backend | DB | API | Frontend | Tests | Docs | Depends on | Acceptance |
|---|---|---|---|---|---|---|---|---|---|
| EP2-T01 | Add `ck_destinations_region` CHECK (8 values) | — | New CHECK constraint | — | — | Insert test per value (8); reject test for an arbitrary value | — | — | Existing `marassi` row passes unaffected |
| EP2-T02 | Update region field to a fixed dropdown in destination create/edit forms | — | — | Reject non-listed region at API validation layer with clear 422 | Replace free-text region input with a select of the 8 values | Form test: only 8 options render; submitting a stale/removed value is rejected client-side before hitting the API | — | EP2-T01 | Editor cannot submit an invalid region from the UI |

---

## EP3 — Optimistic Concurrency Columns

**Objective:** Add the `version` column to `venues` and `destinations` (§4.2
of the frozen spec).
**Scope:** Schema only — the protocol itself (ETag/If-Match wiring) is
Phase 2's EP13.
**Dependencies:** None.
**Size:** S.
**Risk:** Low. Additive column, default `1`, auto-incremented by the
application layer (Phase 2), not by a DB trigger — kept simple per the
frozen spec's "no new infrastructure beyond what's named" standard.
**Acceptance:** Both tables have `version integer NOT NULL DEFAULT 1`;
existing rows backfill to `1` with no data loss.

| ID | Description | Backend | DB | API | Frontend | Tests | Docs | Depends on | Acceptance |
|---|---|---|---|---|---|---|---|---|---|
| EP3-T01 | Add `version` column to `venues` | — | New column, default `1`, backfilled | — | — | Existing rows have `version=1` after migration | — | — | Column present, non-null, default correct |
| EP3-T02 | Add `version` column to `destinations` | — | Same | — | — | Same | — | — | Same |

---

## EP4 — Internationalization Columns

**Objective:** Add `translations` JSONB to `venues` and `destinations` (§5.1).
**Scope:** Schema only. Population happens at Phase 5 (migration) and
ongoing editorial use (Phase 3).
**Dependencies:** None.
**Size:** S.
**Risk:** Low — nullable, additive, no existing-row impact.
**Acceptance:** Column present on both tables, nullable, default `null`.

| ID | Description | Backend | DB | API | Frontend | Tests | Docs | Depends on | Acceptance |
|---|---|---|---|---|---|---|---|---|---|
| EP4-T01 | Add `translations` JSONB column to `venues` | — | New nullable column | — | — | Round-trip test: write `{"ar": {"name": "..."}}`, read back verbatim | — | — | Column present, correct default |
| EP4-T02 | Add `translations` JSONB column to `destinations` | — | Same | — | — | Same | — | — | Same |

---

## EP5 — Beach Details Integrity Constraint

**Objective:** DB-enforce `beach_details`'s key-presence shape (§7.8).
**Scope:** One CHECK constraint: `beach_details IS NULL OR (category =
'Beach' AND beach_details ? 'type' AND beach_details ? 'publicAccess')`.
**Dependencies:** None (column already exists in current schema).
**Size:** XS.
**Risk:** Low.
**Acceptance:** A non-Beach venue with a populated `beach_details` is
rejected at the DB level; a Beach venue missing either key is rejected; a
Beach venue with both keys (even if one value is `null`) is accepted.

| ID | Description | Backend | DB | API | Frontend | Tests | Docs | Depends on | Acceptance |
|---|---|---|---|---|---|---|---|---|---|
| EP5-T01 | Add `ck_venues_beach_details_shape` CHECK | — | New CHECK constraint | — | — | 4 cases: null/ok, non-Beach+populated/reject, Beach+missing-key/reject, Beach+both-keys/accept | — | — | All 4 cases behave as specified |

---

## EP6 — Publish Revision Schema Cleanup

**Objective:** Drop `destination_count`/`venue_count` from `publish_revisions`
(§7.9) — they become computed values (Phase 4's EP25 supplies the
replacement read path).
**Scope:** Column removal only; must land **after** EP25's read-time
replacement ships, never before (removing the columns first would break the
existing revision-list endpoint with no replacement live yet).
**Dependencies:** EP25 (Phase 4) must be deployed first.
**Size:** XS.
**Risk:** Medium if sequenced wrong (breaks revision list if the columns are
dropped before the read-time computation replaces them) — see Critical Path
notes.
**Acceptance:** Columns gone; revision list endpoint's counts are identical
before and after the cutover (verified by parallel-read comparison during
rollout).

| ID | Description | Backend | DB | API | Frontend | Tests | Docs | Depends on | Acceptance |
|---|---|---|---|---|---|---|---|---|---|
| EP6-T01 | Drop `destination_count`/`venue_count` columns | — | Column removal | — | — | Regression: revision-list response shape unchanged from the caller's perspective | — | **EP25-T01 deployed and verified first** | No observable API change; counts still correct |

---

## EP7 — Required Indexes

**Objective:** Add every index named in §3.1 of the frozen spec.
**Scope:** `pg_trgm` extension enablement + one GIN index + five B-tree/
composite indexes.
**Dependencies:** None — purely additive, can run any time, ideally early
since every other phase benefits from it.
**Size:** S.
**Risk:** Low for correctness; index builds on a live table can briefly
contend for locks — must use `CREATE INDEX CONCURRENTLY` in production (an
operational note for Phase 7's deployment task, not a schema change here).
**Acceptance:** All 8 index structures named in §3.1 exist; `EXPLAIN`
confirms each named query pattern uses its intended index rather than a
sequential scan.

| ID | Description | Backend | DB | API | Frontend | Tests | Docs | Depends on | Acceptance |
|---|---|---|---|---|---|---|---|---|---|
| EP7-T01 | Enable `pg_trgm` extension | — | `CREATE EXTENSION pg_trgm` | — | — | — | — | — | Extension available |
| EP7-T02 | `venues(destination_id)` B-tree | — | Index | — | — | — | — | — | Exists |
| EP7-T03 | `venues(category)` B-tree | — | Index | — | — | — | — | — | Exists |
| EP7-T04 | `venues(status)` B-tree | — | Index | — | — | — | — | — | Exists |
| EP7-T05 | `venues(destination_id, status)` composite | — | Index | — | — | `EXPLAIN` test confirms use by the referential-closure publish query (Phase 4) | — | — | Publish query plan uses this index |
| EP7-T06 | `destinations(status)` B-tree | — | Index | — | — | — | — | — | Exists |
| EP7-T07 | `publish_revisions(published_at DESC)` | — | Index | — | — | — | — | — | Revision-list query plan uses it |
| EP7-T08 | `venues(lower(name)) gin_trgm_ops` | — | GIN trigram index | — | — | `EXPLAIN` test confirms `ILIKE '%x%'` query on `q` uses the index at realistic row counts | — | EP7-T01 | Search query plan uses trigram index, not seq scan |

---

# PHASE 2 — Backend API

## EP8 — Venue Lifecycle Completion

**Objective:** Close the "no venue-create endpoint" gap and add media
deletion (§8.2 of the frozen spec, inherited from the prior spec's §8.2).
**Scope:** `POST /editor/venues`, `DELETE /editor/venues/{id}/media`,
reserved-segment validation (§7.7) applied at creation.
**Dependencies:** EP1 (category values must exist to validate against), EP2
is unrelated (venues don't have region).
**Size:** M.
**Risk:** Medium — this is the endpoint the migration (Phase 5) and all
future ordinary editorial growth depend on; getting its validation contract
right matters more than most single endpoints in this backlog.
**Acceptance:** A venue can be created via the API with all required fields
validated identically to what Save Draft already enforces; media deletion
removes the file from storage and clears the corresponding URL field;
creating a venue with id `bulk`/`export`/`duplicates`/`stats` is rejected.

| ID | Description | Backend | DB | API | Frontend | Tests | Docs | Depends on | Acceptance |
|---|---|---|---|---|---|---|---|---|---|
| EP8-T01 | `POST /editor/venues` — create with required fields, `status='draft'` always | New service function, reuses existing validation | — | New route + request schema | — | Create success; missing-required-field 422; reserved-id 422; category-not-in-13 422 | Update API reference | EP1-T01 | Venue created as `draft`, all fields persisted |
| EP8-T02 | `DELETE /editor/venues/{id}/media` | Storage deletion call | — | New route | Remove button on cover/gallery images | Delete cover clears `cover_image_url`; delete gallery item removes it from `gallery_image_urls`; deleting a non-existent file is idempotent (matches legacy behavior) | — | — | File removed from storage; URL field cleared |
| EP8-T03 | Reserved-segment validation on venue/destination id | Validation function shared by both create paths | — | Applied in `POST /editor/venues` and `POST /editor/destinations` | — | Attempt to create with each of the 4 reserved words; all rejected | — | EP8-T01 | 422 on any reserved id |

---

## EP9 — Destination Workflow Parity & Boundary Write Path

**Objective:** Extend destination `PATCH` to accept `boundary` (§7.3), add
destination submit-for-review/approve endpoints for workflow parity with
venues (§9.1 of the prior spec, carried into the frozen spec's workflow
section), add `GET /editor/destinations/{id}/stats`.
**Scope:** Three related but separable API additions.
**Dependencies:** None beyond the base schema.
**Size:** M.
**Risk:** Low-medium — boundary write accepts arbitrary GeoJSON; malformed
input handling needs care (validate `Polygon`/`MultiPolygon` shape, don't
just accept any JSON blob).
**Acceptance:** `boundary` round-trips through `PATCH`; destination can move
through the same `draft → review → approved` states as a venue; stats
endpoint returns venue count, verified count, and category breakdown for one
destination, computed live.

| ID | Description | Backend | DB | API | Frontend | Tests | Docs | Depends on | Acceptance |
|---|---|---|---|---|---|---|---|---|---|
| EP9-T01 | Extend `DestinationUpdate` schema to accept `boundary` | GeoJSON shape validation | — | `PATCH /editor/destinations/{id}` extended | — | Valid `Polygon` accepted; malformed GeoJSON rejected 422; `MultiPolygon` accepted | — | — | Boundary persists and round-trips |
| EP9-T02 | `POST /editor/destinations/{id}/submit-for-review` | Reuses venue's workflow transition pattern | — | New route | — | Draft→review success; review→review (already submitted) 409; validation gate applies (`region` non-blank) | — | EP2-T01 | State transitions correctly, validated |
| EP9-T03 | `POST /editor/destinations/{id}/approve` | — | — | New route | — | Same transition tests as venues' approve | — | EP9-T02 | State transitions correctly |
| EP9-T04 | `GET /editor/destinations/{id}/stats` | Aggregate query (venue count, verified count, category breakdown) | — | New route | Destination detail page shows live stats | Stats match hand-computed values against a fixture destination | — | — | Correct, live-computed counts |

---

## EP10 — Beach Write Path

**Objective:** `PATCH /editor/venues/{id}` accepts `beach_details` when
`category = 'Beach'` (§2.4/§7.8 of the frozen spec).
**Scope:** Schema extension on `VenueUpdate` plus the validation rule.
**Dependencies:** EP5 (DB constraint) should land first so the API and DB
enforce the same rule, not just the API alone.
**Size:** S.
**Risk:** Low.
**Acceptance:** A `Beach`-category venue accepts `{"type": ..., "publicAccess":
...}`; a non-`Beach` venue sending `beach_details` is rejected 422; the
three `publicAccess` values are the only ones accepted.

| ID | Description | Backend | DB | API | Frontend | Tests | Docs | Depends on | Acceptance |
|---|---|---|---|---|---|---|---|---|---|
| EP10-T01 | Extend `VenueUpdate` schema with optional `beach_details` | Category-conditional validation function | — | `PATCH /editor/venues/{id}` extended | — | Beach+valid shape/accept; Beach+missing key/422; non-Beach+populated/422; invalid `publicAccess` value/422 | — | EP5-T01 | Matches DB constraint exactly — no daylight between API and DB rules |

---

## EP11 — Reject Workflow (Reason-Required)

**Objective:** `review → draft` (Reject) requires a non-blank reason,
recorded to `activity_log` (§7.4).
**Scope:** New reject endpoint for both venues and destinations (currently
this transition may not have a dedicated endpoint at all — confirm during
implementation; if it's currently implicit, this task makes it explicit).
**Dependencies:** None.
**Size:** S.
**Risk:** Low.
**Acceptance:** Reject without a `reason` field is rejected 422; a
successful reject logs `{"reason": "..."}` to `activity_log`.

| ID | Description | Backend | DB | API | Frontend | Tests | Docs | Depends on | Acceptance |
|---|---|---|---|---|---|---|---|---|---|
| EP11-T01 | `POST /editor/venues/{id}/reject` requiring `reason` | Activity log write | — | New/updated route | — | Missing reason/422; success writes `activity_log` row with reason in metadata | — | — | Reason always recorded |
| EP11-T02 | `POST /editor/destinations/{id}/reject` requiring `reason` | Same | — | New/updated route | — | Same | — | EP9-T02 | Same |

---

## EP12 — Referential Closure Enforcement

**Objective:** Implement §1 of the frozen spec — the approve-time gate and
the publish-time filter that together guarantee no published venue ever
references a destination absent from the same snapshot.
**Scope:** This is the single most architecturally important epic in the
backlog — it closes the Critical finding from the architecture review.
**Dependencies:** EP7-T05 (composite index) should exist before this ships,
so the new gate/filter isn't the first thing to discover a missing index in
production.
**Size:** M.
**Risk:** Medium — this changes existing, working behavior (the Approve
endpoint), so it must be implemented carefully against the full existing
test suite, not just new tests.
**Acceptance:** Approving a venue whose destination is not `approved` is
rejected 422 with `destination_not_approved`; the publish engine's query
becomes the join described in §1.2; `excluded_venue_count` appears in
`PublishRevisionOut`; each exclusion is logged.

| ID | Description | Backend | DB | API | Frontend | Tests | Docs | Depends on | Acceptance |
|---|---|---|---|---|---|---|---|---|---|
| EP12-T01 | Approve-time gate: reject venue approval if destination not `approved` | New check in the approve service function | — | `POST /editor/venues/{id}/approve` (and bulk variant) | Error message surfaced in Studio | Approve venue under draft destination → 422; approve under approved destination → success | — | — | Gate enforced on both single and bulk approve |
| EP12-T02 | Rewrite publish query as a join, not two independent filters | Publish engine rewritten per §1.2 | — | — | — | Fixture: venue approved, destination later archived → publish excludes the venue, does not fail | — | EP7-T05 | Snapshot never contains an orphaned `destination_id` |
| EP12-T03 | Add `excluded_venue_count` to `PublishRevisionOut` and the publish response | — | — | Schema field added | Publish confirmation shows exclusion count if nonzero | Publish with 0 exclusions → field is `0`; publish with N drifted venues → field is `N` | Update API reference | EP12-T02 | Field always present, always correct |
| EP12-T04 | Log each exclusion to `activity_log` | `action: "publish_excluded_orphan_venue"` | — | — | — | One log row per excluded venue, correct metadata | — | EP12-T02 | Exclusions fully traceable via Activity page |

---

## EP13 — Concurrency Protocol

**Objective:** Implement §4's ETag/If-Match protocol for `venues` and
`destinations`.
**Scope:** Response header on GET, required header on PATCH, 428/409
handling, version increment on successful write.
**Dependencies:** EP3 (version columns must exist).
**Size:** M.
**Risk:** Medium — this changes the contract of every existing `PATCH`
caller (Studio must send `If-Match` from this point forward); must ship
backend and frontend (EP22) together or in immediate sequence to avoid a
window where every PATCH from the current Studio build fails with 428.
**Acceptance:** `GET` returns `ETag: "<version>"`; `PATCH` without
`If-Match` → 428; `PATCH` with stale `If-Match` → 409 with current state and
version in the body; successful `PATCH` increments `version` by exactly 1.

| ID | Description | Backend | DB | API | Frontend | Tests | Docs | Depends on | Acceptance |
|---|---|---|---|---|---|---|---|---|---|
| EP13-T01 | `ETag` response header on venue/destination `GET` | — | — | Header middleware/response modification | — | Header value matches `version` | — | EP3-T01, EP3-T02 | Present on both entity GETs |
| EP13-T02 | `If-Match` required + version-check on `PATCH` | Version comparison in update service | — | `PATCH` handlers updated | — | No header → 428; stale version → 409 + current state/version in body; matching version → success, version+1 | Document the new required header in the API reference | EP13-T01 | Behaves exactly per §4.3 |

---

## EP14 — Statistics & Export Endpoints

**Objective:** `GET /editor/stats` (§2.9) and export endpoints for venues
and destinations (§8.7 of the prior spec, carried forward).
**Scope:** Two read-only, computed-at-request-time endpoint families.
**Dependencies:** None.
**Size:** M.
**Risk:** Low.
**Acceptance:** Stats match the field list in §2.9 exactly, computed live;
export returns CSV or JSON per a `format` query parameter, containing every
field the corresponding `*Out` schema exposes.

| ID | Description | Backend | DB | API | Frontend | Tests | Docs | Depends on | Acceptance |
|---|---|---|---|---|---|---|---|---|---|
| EP14-T01 | `GET /editor/stats` | Aggregate queries per §2.9's field list | — | New route | Dashboard consumes it (Phase 3) | Each of the 9 fields matches a hand-computed fixture value | — | — | Live-computed, no stored table |
| EP14-T02 | `GET /editor/venues/export?format=csv\|json` | Serialization | — | New route | Export button (Phase 3) | Both formats produce parseable output with correct row counts and field coverage | — | — | Every `VenueOut` field present in export |
| EP14-T03 | `GET /editor/destinations/export?format=csv\|json` | Same | — | New route | Same | Same | — | — | Same |

---

## EP15 — Bulk Endpoint Unification

**Objective:** Replace `bulk/category` + `bulk/destination` with one
`PATCH /editor/venues/bulk` (§7.6).
**Scope:** New unified endpoint; old two removed in the same change (this is
pre-migration, so no external consumer compatibility burden — Studio is the
only caller and is updated in the same PR).
**Dependencies:** None.
**Size:** S.
**Risk:** Low — internal-only consumer.
**Acceptance:** One call can update `category`, `destination_id`, or both,
across a venue-id list; old endpoints no longer exist.

| ID | Description | Backend | DB | API | Frontend | Tests | Docs | Depends on | Acceptance |
|---|---|---|---|---|---|---|---|---|---|
| EP15-T01 | `PATCH /editor/venues/bulk` unified endpoint | Merge two existing service functions | — | New route, old two removed | Studio bulk-action calls updated to the new endpoint | Category-only, destination-only, and both-at-once cases all succeed; partial failure within a batch reports per-item results (existing `BulkResultItem` shape) | Update API reference | — | Old endpoints gone, no capability regression |

---

## EP16 — API Versioning Declaration

**Objective:** Implement §6 — declare current surface v1, no route changes.
**Scope:** Documentation and a lightweight response-header confirmation, not
a code redesign.
**Dependencies:** None — can run any time, ideally early since it's zero-risk.
**Size:** XS.
**Risk:** None — purely additive/documentary.
**Acceptance:** API reference states the versioning policy verbatim from
§6.2–6.4; no route paths change.

| ID | Description | Backend | DB | API | Frontend | Tests | Docs | Depends on | Acceptance |
|---|---|---|---|---|---|---|---|---|---|
| EP16-T01 | Document v1 versioning policy in the API reference | — | — | Optional: `API-Version: v1` response header | — | If header added, present on every response | Full policy text from §6 | — | Policy documented and (optionally) machine-visible |

---

# PHASE 3 — Studio (DataLab)

## EP17 — Publish & Rollback Controls

**Objective:** Close the highest-severity Studio gap — publish and
republish are API-complete but have no UI (§9.1 of the prior spec, carried
into the frozen spec unchanged).
**Dependencies:** EP12 (referential closure) should ship first so the
Publish button's confirmation dialog can show `excluded_venue_count` from
day one, not as a follow-up.
**Size:** M.
**Risk:** Low-medium — this is the button that makes the whole platform's
core purpose reachable; needs a clear confirmation step given it's a
whole-site action.
**Acceptance:** An editor can publish and see the resulting revision,
including any exclusion count; an editor can republish to a prior revision
from the revision list.

| ID | Description | Backend | DB | API | Frontend | Tests | Docs | Depends on | Acceptance |
|---|---|---|---|---|---|---|---|---|---|
| EP17-T01 | Publish button + confirmation dialog on the Publishing page | — | — | Calls existing `POST /editor/publish` | New control | Click → confirm → publish succeeds → revision appears in list | — | EP12-T03 | Exclusion count shown if nonzero |
| EP17-T02 | Republish control on revision detail view | — | — | Calls existing `POST .../republish` | New control | Click → confirm → `is_current` moves to selected revision | — | EP17-T01 | Rollback works end-to-end from the UI |

---

## EP18 — Dashboard Statistics

**Objective:** Replace the hardcoded welcome placeholder with real stats
(§2.9).
**Dependencies:** EP14-T01.
**Size:** S.
**Risk:** Low.
**Acceptance:** Dashboard shows live venue/destination/category counts and
coverage percentages.

| ID | Description | Backend | DB | API | Frontend | Tests | Docs | Depends on | Acceptance |
|---|---|---|---|---|---|---|---|---|---|
| EP18-T01 | Dashboard stat tiles | — | — | Consumes `GET /editor/stats` | Rebuild `Dashboard.tsx` | Renders correct values against a fixture | — | EP14-T01 | No more hardcoded placeholder |

---

## EP19 — Venue Create Form & Beach Fields

**Objective:** UI for `POST /editor/venues` (EP8) and conditional beach
fields (EP10).
**Dependencies:** EP8-T01, EP10-T01.
**Size:** M.
**Risk:** Low.
**Acceptance:** An editor can create a venue from the Studio; selecting
`Beach` as category reveals `type`/`publicAccess` fields.

| ID | Description | Backend | DB | API | Frontend | Tests | Docs | Depends on | Acceptance |
|---|---|---|---|---|---|---|---|---|---|
| EP19-T01 | "New Venue" form | — | — | Calls `POST /editor/venues` | New form, all required fields, 13-value category select | Submit success → venue appears in list; missing-required-field shows inline error | — | EP8-T01, EP1-T02 | Matches API validation exactly, no silent mismatch |
| EP19-T02 | Conditional beach fields in venue editor | — | — | Sends `beach_details` on save when relevant | `type`/`publicAccess` inputs shown only for `category='Beach'` | Switching category to/from Beach shows/hides fields correctly; save round-trips | — | EP10-T01, EP19-T01 | No way to submit `beach_details` for a non-Beach venue from the UI |

---

## EP20 — Export & Image Delete UI

**Objective:** Frontend for EP14's export endpoints and EP8-T02's media
delete.
**Dependencies:** EP14-T02/T03, EP8-T02.
**Size:** S.
**Risk:** Low.
**Acceptance:** Export button downloads a file in the chosen format; a
remove control appears on every cover/gallery image and works.

| ID | Description | Backend | DB | API | Frontend | Tests | Docs | Depends on | Acceptance |
|---|---|---|---|---|---|---|---|---|---|
| EP20-T01 | Export button (venues + destinations) | — | — | Calls export endpoints | New control, format choice | Click → file downloads, correct row count | — | EP14-T02, EP14-T03 | — |
| EP20-T02 | Image delete control | — | — | Calls `DELETE .../media` | Remove icon on each image | Click → confirm → image gone from UI and storage | — | EP8-T02 | — |

---

## EP21 — Reject Reason UI

**Objective:** Frontend for EP11.
**Dependencies:** EP11-T01, EP11-T02.
**Size:** XS.
**Risk:** None.
**Acceptance:** Reject action requires a non-blank reason before submitting.

| ID | Description | Backend | DB | API | Frontend | Tests | Docs | Depends on | Acceptance |
|---|---|---|---|---|---|---|---|---|---|
| EP21-T01 | Reject reason input (modal or inline) | — | — | Sends `reason` in reject call | New control | Submit blocked until reason non-blank; success clears the review queue item | — | EP11-T01 | — |

---

## EP22 — Concurrency Client Integration

**Objective:** Studio's API client (`apiClient.ts`) tracks and sends
`If-Match`, handles `409`/`428` (§4).
**Dependencies:** EP13 (must ship in the same release window — see Critical
Path).
**Size:** M.
**Risk:** Medium — every existing edit flow in the Studio touches this; a
mistake here breaks Save Draft platform-wide, not just one feature.
**Acceptance:** Every GET that returns an editable entity captures its
`ETag`; every subsequent PATCH sends it as `If-Match`; a `409` response
prompts the editor to reload rather than silently retrying or losing their
edit.

| ID | Description | Backend | DB | API | Frontend | Tests | Docs | Depends on | Acceptance |
|---|---|---|---|---|---|---|---|---|---|
| EP22-T01 | Capture `ETag` on venue/destination GET | — | — | — | `apiClient.ts` reads response header, stores alongside entity state | Fetch → version captured correctly | — | EP13-T01 | — |
| EP22-T02 | Send `If-Match` on PATCH; handle `409` | — | — | — | On 409: surface "changed by someone else," offer reload | Simulated stale-version PATCH → 409 → UI shows conflict, not a silent failure or crash | — | EP22-T01, EP13-T02 | No silent data loss on conflict |

---

## EP23 — Translations Editing (Minimal)

**Objective:** A minimal control for editors to enter an Arabic name (§5.1,
§5.6) — not a full localization editor, just what the spec requires exist.
**Dependencies:** EP4 (schema).
**Size:** S.
**Risk:** Low.
**Acceptance:** An editor can enter and save `translations.ar.name`
alongside the canonical `name`.

| ID | Description | Backend | DB | API | Frontend | Tests | Docs | Depends on | Acceptance |
|---|---|---|---|---|---|---|---|---|---|
| EP23-T01 | Add optional "Arabic name" field to venue/destination edit forms | — | — | `PATCH` accepts `translations` | New optional input | Save round-trips `translations.ar.name` | — | EP4-T01, EP4-T02 | Field is optional, doesn't block save when empty |

---

# PHASE 4 — Publishing

## EP24 — (See EP12 above — the engine change lives in Phase 2 because it's
inseparable from the API contract change.) No additional tasks here; this
entry exists to make explicit that Publishing-phase work is **not** limited
to Phase 2/3's items — the next epic, EP25, is the one Publishing-specific
item not already covered.

## EP25 — Revision Count Computation

**Objective:** Replace stored `destination_count`/`venue_count` with
read-time `jsonb_array_length` computation (§7.9), as the prerequisite for
EP6's column drop.
**Dependencies:** None technically, but **must ship and be verified before
EP6 removes the columns** (see EP6's note).
**Size:** S.
**Risk:** Low, but sequencing matters — see Critical Path.
**Acceptance:** Revision list response is byte-for-byte identical to the
stored-column version, for every existing revision, before the columns are
removed.

| ID | Description | Backend | DB | API | Frontend | Tests | Docs | Depends on | Acceptance |
|---|---|---|---|---|---|---|---|---|---|
| EP25-T01 | Compute counts from `snapshot` at read time in the revision-list/detail serializer | Read path only, no write path change | — | `PublishRevisionOut` response unchanged in shape | — | Parallel-read test: computed value equals stored value for every existing revision, before EP6 runs | — | — | Zero observable difference to callers |

---

# PHASE 5 — Migration

*(Every task here executes the frozen spec's §2 and §7.3 exactly as written
— no new decisions are made in this phase; only the already-frozen decisions
are carried out.)*

## EP26 — Pre-Migration Preparation

**Objective:** Everything that must be true before the import script runs.
**Dependencies:** Phases 1–2 fully deployed (the migration script uses the
platform's own models and validation function, per §10.3/10.4 — it cannot
run against a database that doesn't yet have the frozen schema).
**Size:** S.
**Risk:** Low, but this is where a skipped step becomes an irreversible
mistake — see Acceptance.
**Acceptance:** Backup taken and verified restorable; test destination row
confirmed absent; region values assigned for all 24 new destinations
(§7.3's 8-value list) with any unassignable destination's name recorded for
exclusion, exactly as beaches' 3 unresolvable records are handled.

| ID | Description | Backend | DB | API | Frontend | Tests | Docs | Depends on | Acceptance |
|---|---|---|---|---|---|---|---|---|---|
| EP26-T01 | Take and verify a full database backup | `backup_db.sh` execution | — | — | — | Restore drill against a scratch DB confirms the backup is valid | — | Phases 1–2 deployed | Backup exists and is proven restorable |
| EP26-T02 | Confirm and remove `test-dest-98e967ef` | — | Row deletion | — | — | Post-check: `SELECT` confirms absence | — | EP26-T01 | Row absent before migration begins |
| EP26-T03 | Assign region values (8-value set) to the 24 new destinations | Data preparation, not code | — | — | — | Every assigned destination has a value in the 8-value set; unassignable ones listed explicitly, not guessed | Written record of the assignment, for the verification report (EP29) | EP2-T01 | 24 destinations reconciled or explicitly excluded, none guessed |

---

## EP27 — Destination & Venue Import Script

**Objective:** The one-time script implementing §10.1's mapping.
**Dependencies:** EP26, and every Phase 1/2 schema and validation-path task
this script relies on (EP1, EP2, EP4 for `translations`, EP8 for using the
same validation function `POST /editor/venues` uses).
**Size:** L.
**Risk:** Medium-high — this is the one irreversible-if-wrong step in the
whole backlog; mitigated entirely by EP28's dry run before it ever touches
production.
**Acceptance:** Destinations reconciled by slug, `marassi` updated in place
without overwriting its existing `region`/`status`; all migratable venues
imported as `draft`; `external_link` and `geo` handled exactly per §10.2 and
§5.6; single transaction, all-or-nothing.

| ID | Description | Backend | DB | API | Frontend | Tests | Docs | Depends on | Acceptance |
|---|---|---|---|---|---|---|---|---|---|
| EP27-T01 | Destination reconciliation (slug-match, update-in-place) | Script using platform models directly | — | — | — | `marassi` retains original `region`/`status`, gains `boundary`; 24 others created | Migration runbook entry | EP26-T03 | No destination duplicated |
| EP27-T02 | Venue import (draft status, category/region already valid by construction) | Same, reuses `validate_venue` | — | — | — | Every imported venue passes validation; zero rejected on category (13-value set already covers all legacy values) | — | EP27-T01, EP1-T01 | 100% of eligible venues imported |
| EP27-T03 | `external_link` handling: merge into `website` or `internal_notes` | Per §10.2's exact rule | — | — | — | The 1 affected record verified by hand against the rule | — | EP27-T02 | No silent drop |
| EP27-T04 | `geo` → `legacy_geo` verbatim copy | Straight copy, no transformation | — | — | — | All 426 records' `legacy_geo` matches source `geo` byte-for-byte (as JSON) | — | EP27-T02 | No data loss |
| EP27-T05 | Arabic-name detection → `translations.ar.name` (§5.6) | Non-ASCII detection rule | — | — | — | Every non-ASCII legacy `name` produces a matching `translations.ar.name` | — | EP27-T02, EP4-T01 | Rule applied mechanically, no manual judgment calls |

---

## EP28 — Beach Import

**Objective:** Execute §2.2–2.3's beach identity/mapping exactly.
**Dependencies:** EP10 (write path must exist before import, per the frozen
spec's own non-negotiable requirement), EP27 (destinations must exist to
resolve `destSlug`... actually beaches resolve by destination *name*, not
slug — confirm against §2.3's exact rule during implementation).
**Size:** M.
**Risk:** Medium — the one part of migration with a genuinely novel
algorithm (slugified id derivation) rather than a straight field copy.
**Acceptance:** All resolvable beaches (184 of 187) imported with
deterministic ids per §2.2's algorithm; the 3 unresolvable (`Fouka`,
`Ras El Hekma`, `Sidi Abdelrahman`) excluded and reported by name;
coordinates `NULL` for all; `beach_details` populated and passing EP5's
constraint.

| ID | Description | Backend | DB | API | Frontend | Tests | Docs | Depends on | Acceptance |
|---|---|---|---|---|---|---|---|---|---|
| EP28-T01 | Implement the id/slug derivation algorithm (§2.2) | Script function, unit-testable in isolation | — | — | — | Deterministic: running twice on the same input produces identical ids; collision case produces `-2` suffix correctly | Algorithm documented in the migration runbook, verbatim from §2.2 | EP10-T01 | Reproducible, collision-safe |
| EP28-T02 | Destination-name matching + 3-record exclusion | Case-insensitive exact match | — | — | — | 184 resolve, exactly 3 excluded and named in output | — | EP28-T01, EP27-T01 | Matches the audited count exactly |
| EP28-T03 | Import as `category='Beach'`, `status='draft'`, `beach_details` populated | — | — | — | — | Every imported beach passes EP5's CHECK constraint | — | EP28-T02, EP5-T01 | Zero constraint violations |

---

## EP29 — Dry Run & Verification Report

**Objective:** Execute §10.7 (dry run) and §10.6 (verification), and check
§10.8's acceptance criteria.
**Dependencies:** EP27, EP28 fully implemented (the dry run runs the exact
same script the real migration will).
**Size:** M.
**Risk:** Low — this is the safety net, not the risk.
**Acceptance:** Dry-run report and real-run report match line-for-line
except for row-count-appropriate differences; every §10.8 criterion holds.

| ID | Description | Backend | DB | API | Frontend | Tests | Docs | Depends on | Acceptance |
|---|---|---|---|---|---|---|---|---|---|
| EP29-T01 | Run the migration against a disposable schema copy | — | Scratch DB, not production | — | — | — | — | EP27, EP28 | Completes without error |
| EP29-T02 | Generate the mechanical verification report (§10.6) | Row counts, FK integrity, duplicate checks | — | — | — | Report generator itself tested against known-good and known-bad fixtures | Report format documented | EP29-T01 | Report produced, human-reviewable |
| EP29-T03 | Run the real migration against production, compare reports | — | Production write, single transaction | — | — | — | Final report archived | EP29-T02, EP26-T01 (backup) | All §10.8 criteria satisfied |

---

# PHASE 6 — Testing

## EP30 — Schema/Constraint Test Suite

**Objective:** Direct tests for every constraint added in Phase 1.
**Dependencies:** EP1, EP2, EP3, EP4, EP5, EP6, EP7.
**Size:** M. **Risk:** Low.
**Acceptance:** Every constraint has both a passing and a failing test case.

| ID | Description | Depends on | Acceptance |
|---|---|---|---|
| EP30-T01 | Category CHECK (13 values) tests | EP1-T01 | Covered in EP1-T01, referenced here for suite completeness |
| EP30-T02 | Region CHECK (8 values) tests | EP2-T01 | Same |
| EP30-T03 | `version` default/backfill tests | EP3 | Same |
| EP30-T04 | `translations` shape/round-trip tests | EP4 | Same |
| EP30-T05 | `beach_details` CHECK tests | EP5-T01 | Same |
| EP30-T06 | Index existence + `EXPLAIN` plan tests | EP7 | Same |

*(Individually specified already inside each Phase 1 epic — listed here as a
single suite so Phase 6's exit criteria are explicit: this suite is green
before Phase 2 work is considered mergeable against a stable base.)*

## EP31 — New Endpoint Contract Test Suite

**Objective:** Full request/response contract tests for every Phase 2
addition.
**Dependencies:** EP8–EP16.
**Size:** L. **Risk:** Low.
**Acceptance:** Every new/changed endpoint has success, validation-failure,
and permission-denial test cases.

| ID | Description | Depends on |
|---|---|---|
| EP31-T01 | `POST /editor/venues` contract tests | EP8-T01 |
| EP31-T02 | `DELETE .../media` contract tests | EP8-T02 |
| EP31-T03 | Destination boundary/workflow-parity/stats contract tests | EP9 |
| EP31-T04 | Beach write path contract tests | EP10-T01 |
| EP31-T05 | Reject-with-reason contract tests | EP11 |
| EP31-T06 | Stats/export contract tests | EP14 |
| EP31-T07 | Unified bulk endpoint contract tests | EP15-T01 |

## EP32 — Concurrency & Referential-Closure Test Suite

**Objective:** The two highest-stakes behavioral changes get dedicated,
scenario-driven suites, not just contract tests.
**Dependencies:** EP12, EP13, EP22.
**Size:** M. **Risk:** Low (the suite; the feature it tests is
medium-risk, covered by having this suite at all).
**Acceptance:** Every scenario named in §1 and §4 of the frozen spec has an
explicit test.

| ID | Description | Depends on |
|---|---|---|
| EP32-T01 | Approve blocked when destination not approved | EP12-T01 |
| EP32-T02 | Publish excludes drifted venue, does not fail whole publish | EP12-T02 |
| EP32-T03 | Exclusion logged to `activity_log` | EP12-T04 |
| EP32-T04 | Concurrent PATCH: matching version succeeds, version increments | EP13-T02 |
| EP32-T05 | Concurrent PATCH: stale version → 409 with current state | EP13-T02 |
| EP32-T06 | Missing `If-Match` → 428 | EP13-T02 |

## EP33 — Migration Dry-Run Test Harness

**Objective:** Automated checks around EP29's dry run, beyond manual report
review.
**Dependencies:** EP29.
**Size:** M. **Risk:** Low.
**Acceptance:** Harness fails the pipeline if any §10.8 criterion is
violated — this is a gate, not just a report.

| ID | Description | Depends on |
|---|---|---|
| EP33-T01 | Automated FK-integrity check post-dry-run | EP29-T01 |
| EP33-T02 | Automated duplicate-id/slug check post-dry-run | EP29-T01 |
| EP33-T03 | Automated category/region legality check (should be zero violations by construction — this test exists to *prove* that, not to catch a surprise) | EP1-T01, EP2-T01, EP29-T01 |

## EP34 — Full Regression Pass

**Objective:** The existing 233-test suite (pre-dating this backlog) must
still pass in full after every phase — not just the new tests.
**Dependencies:** All of Phase 1–5.
**Size:** S (running it) but this is a **gate**, not a feature — it belongs
at the end of every phase, not just once at the end of the project.
**Risk:** Low if run continuously; high if deferred to the very end (see
Critical Path).
**Acceptance:** 233/233 (plus every test added in EP30–EP33) passes after
each phase's merge, not just at final sign-off.

---

# PHASE 7 — Production Readiness

## EP35 — Index Deployment & Verification

**Objective:** Deploy Phase 1's indexes to production without locking
writes.
**Dependencies:** EP7 implemented and tested against a staging-scale dataset.
**Size:** S. **Risk:** Medium — index builds on a live table need
`CONCURRENTLY` and monitoring, not a plain `CREATE INDEX`.
**Acceptance:** All indexes present in production; no write downtime during
creation; query plans confirmed via `EXPLAIN` against real data volumes
post-migration.

## EP36 — Documentation Realignment

**Objective:** `docs/DATABASE.md`, `docs/SECURITY.md`, `docs/DEPLOYMENT.md`
updated to describe the frozen spec's actual, implemented state — closing
the gap the original audit found between documentation and reality, this
time preventing it from recurring.
**Dependencies:** All prior phases implemented (documentation should
describe what's true, not what's planned).
**Size:** M. **Risk:** Low.
**Acceptance:** Every field/endpoint/constraint named in
`PLATFORM_SPEC_v1.0_FROZEN.md` is discoverable in the operational docs a new
engineer would actually read.

## EP37 — Production Deployment & Smoke Test

**Objective:** Deploy the full implementation, run the same smoke-test
discipline already established for this platform (health, CORS, Supabase
connectivity, static assets, SSL, clean logs).
**Dependencies:** Everything above.
**Size:** M. **Risk:** Low, given the existing deployment process is already
proven across prior releases.
**Acceptance:** Full production checklist green, including the new
endpoints and the migration's post-import verification report.

## EP38 — Legacy `legacy_geo` Retirement Tracking

**Objective:** Implement §7.13's pre-authorized drop condition as a tracked,
dated reminder — not code, a scheduling artifact.
**Dependencies:** EP27-T04 (the column must actually be populated by
migration first) — the 90-day clock (§7.13) starts at migration completion,
not at this task's completion.
**Size:** XS. **Risk:** None.
**Acceptance:** A dated reminder exists (e.g., a tracked issue) to revisit
`legacy_geo`'s removal 90 days after Phase 5 completes, per the frozen
spec's exact pre-authorization condition.

---

# Critical Path

```
EP1 (category) ──┐
EP2 (region)  ────┤
EP3 (version) ────┼──► EP8 (venue create) ──► EP19 (create form) ──┐
EP4 (i18n cols) ──┤                                                 │
EP5 (beach chk) ──┤──► EP10 (beach write) ──► EP19-T02 ──► EP28 (beach import)
EP7 (indexes) ────┘                                                 │
                                                                     │
EP12 (referential closure) ──► EP17 (publish UI) ───────────────────┤
     │                                                               │
     └──► EP25 (revision counts) ──► EP6 (drop columns)              │
                                                                     │
EP13 (concurrency API) ──► EP22 (concurrency client) ────────────────┤
                                                                     ▼
EP26 (pre-migration prep) ──► EP27 (dest/venue import) ──► EP29 (dry run + real run)
                                                                     │
                                                                     ▼
                                                    EP30–34 (test gates, continuous)
                                                                     │
                                                                     ▼
                                              EP35–38 (production readiness)
```

**The true critical path — the longest chain nothing else can shortcut —
is:**

> `EP1/EP2/EP4/EP5 (schema)` → `EP8/EP10 (venue create + beach write)` →
> `EP26 (prep)` → `EP27/EP28 (import)` → `EP29 (dry run + real run)` →
> `EP35/EP37 (production deployment)`

Everything else in this backlog (Dashboard, export, image delete, i18n
editing UI, API versioning docs, bulk unification) is **not** on this path —
it improves the platform but does not block migration or launch.

---

## Blockers (hard dependencies — cannot start early)

- **EP6 (drop revision counts) cannot start before EP25 is deployed and
  verified.** Reversing this order breaks the revision list with no
  replacement live.
- **EP27/EP28 (import scripts) cannot start before EP8/EP10 exist** — the
  frozen spec requires migration to reuse the platform's own validation
  function, which means the write paths (venue create, beach write) must
  exist first, not be built alongside the import script.
- **EP29-T03 (real migration run) cannot start before EP26-T01 (verified
  backup) and EP29-T01/T02 (dry run + report) are both complete.**
- **EP12 (referential closure) should land before EP17 (publish UI)** — not
  a hard blocker (the button could technically ship first), but shipping the
  UI before the exclusion-count field exists means a follow-up UI change is
  needed almost immediately; sequencing it this way avoids that rework.
- **EP13 and EP22 (concurrency backend + client) must ship in the same
  release, never independently** — shipping EP13 alone breaks every existing
  Studio PATCH call (they'd all get 428, having never sent `If-Match`);
  shipping EP22 alone is a no-op with nothing to talk to. Treat these two as
  one atomic release unit despite being separate epics.

## What can run in parallel

- **All of Phase 1's epics (EP1–EP7) are mutually independent** — different
  columns/constraints/indexes on different (or non-overlapping) parts of the
  same two tables. A single engineer or several in parallel, no coordination
  needed beyond normal migration-file ordering.
- **Within Phase 2, EP9, EP11, EP14, EP15, EP16 are independent of each
  other and of EP12/EP13** — they touch different endpoints with no shared
  state. EP8 and EP10 share the `Venue` model but touch different fields
  (creation vs. `beach_details`) and can proceed in parallel with care taken
  only at merge time (standard field-addition conflict, not a design
  conflict).
- **Within Phase 3, EP18, EP20, EP21, EP23 are independent of each other**
  and can be built by different people the moment their respective Phase 2
  dependency lands. EP17 and EP19 are the two with real Phase-2 sequencing
  dependencies (EP12, EP8/EP10 respectively).
- **EP30–EP33 (test suites) can be written test-first, alongside their
  corresponding implementation epics**, rather than strictly after — the
  dependency arrows point at *what the tests verify*, not at a mandate that
  tests must be written last.
- **EP35 (indexing) and EP36 (documentation) can both start as soon as their
  respective source epics are done**, independent of each other and of the
  migration phase.

---

# Recommended Implementation Order

The order below is chosen to minimize two things simultaneously: **merge
conflicts** (by sequencing shared-file changes rather than parallelizing
them blindly) and **technical debt** (by never building on top of a
not-yet-verified layer — every phase's exit gate is "Phase N's own tests
pass," not "Phase N's code is written").

1. **Phase 1 in full** (EP1–EP7), all epics in parallel — no shared-file
   contention (different constraints/columns), lowest-risk phase, unblocks
   everything else. **Exit gate: EP30 green.**
2. **Phase 2, first wave** — EP8, EP9, EP10, EP11, EP14, EP15, EP16 in
   parallel (independent endpoints). **Then** EP12 and EP13 as a second wave
   (both touch the Approve/PATCH hot paths other Phase 2 work doesn't, and
   EP12 specifically changes behavior the first wave's tests should already
   have established a stable baseline for). **Exit gate: EP31 + EP32 green,
   EP34 (full regression) still green.**
3. **Phase 3**, matched one-for-one against whichever Phase 2 epic each
   Studio epic depends on — **except EP13/EP22, which ship together as one
   atomic release** per the Blockers section above. **Exit gate: manual
   Studio smoke test + EP34 green.**
4. **Phase 4's EP25**, then **EP6** (the drop) only after EP25 is verified
   in production, not just in a test environment — this is the one place in
   the whole backlog where "tests pass" is not sufficient evidence; a
   production read-path comparison is required first.
5. **Phase 5 in full sequence** (EP26 → EP27 → EP28 → EP29) — this phase is
   inherently serial, not parallelizable, by the nature of a single
   one-time migration event.
6. **Phase 6's remaining suites** (EP33, and a final EP34 run) as the
   explicit gate before Phase 7 — not a formality, the actual go/no-go for
   production deployment.
7. **Phase 7** (EP35–EP38) last, in the order listed — indexing before
   deployment (so the newly-migrated, larger dataset never runs unindexed
   even briefly), documentation before or alongside deployment (never
   after, so the deployed system is never undocumented even temporarily),
   deployment itself, then the retirement-tracking task as pure
   bookkeeping.

**Why this order minimizes technical debt specifically:** every phase's exit
gate is a passing test suite *and* (where applicable, per Blockers) a
production-verified read path — never "the code merged." This is the direct
implementation of the frozen spec's own Principle 1.7 (backward-compatible
migration, no second event) and Principle 1.9 (frozen means frozen) applied
to the *build* process, not just the schema: nothing here is sequenced so
that a later phase might reveal an earlier one needs to be redone.
