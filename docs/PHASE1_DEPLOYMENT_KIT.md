# Phase 1 Deployment Kit
### Category → Tags → Access Type → Badges → Collections

**Status: Operational documentation only. No code, no migrations, no data changes.** Everything in this document is preparation to be *executed* once someone runs the actual migration — nothing here has been run yet. Alembic is confirmed at revision `0013` as of this writing; every command below assumes that starting point.

This kit is deliberately one document, not six — the six deliverables you asked for are its sections, in execution order, so whoever runs this can go top to bottom without switching files.

---

## 1. Migration Execution Guide

### Pre-flight checks

```bash
cd api
alembic current
```
**Expected output:** `0013` (head). If it already shows `0014`/`0015`/`0016`, **stop** — someone already migrated; do not re-run.

```bash
which pg_dump psql
```
**Expected:** both resolve to a real path. If either is missing, install PostgreSQL client tools before continuing — the backup step below hard-requires `pg_dump`.

```bash
echo $DATABASE_URL   # or: grep DATABASE_URL api/.env
```
Confirm out loud/in writing which database this is (dev/staging/production) before proceeding — this is the single most important pre-flight check, not a formality.

### Step 1 — Backup

```bash
cd api
./scripts/backup_db.sh
# or, to control the output location:
./scripts/backup_db.sh /path/to/backups
```

**Expected output:**
```
Backing up database to <path>/sahelspot_backup_<YYYYMMDD_HHMMSS>.sql.gz ...
Backup complete: <path>/sahelspot_backup_<YYYYMMDD_HHMMSS>.sql.gz (<size>)
```
Exit code `0`. **Verify before continuing:**
```bash
gunzip -c <backup_file> | head -50
```
Should show real `CREATE TABLE`/`COPY` statements, not an empty or truncated file. **Record the exact backup filename** — it's the rollback target for every step below.

### Step 2 — Apply migrations

```bash
cd api
alembic upgrade head
```

**Expected output** (three migrations, in order):
```
INFO  [alembic.runtime.migration] Running upgrade 0013 -> 0014, tags
INFO  [alembic.runtime.migration] Running upgrade 0014 -> 0015, collections
INFO  [alembic.runtime.migration] Running upgrade 0015 -> 0016, venue access type and reservation policy
```
No `ERROR`/traceback output. Exit code `0`.

**Immediate verification:**
```bash
alembic current
```
**Expected:** `0016 (head)`.

### Failure recovery (during Step 2)

Alembic migrations in this repo run inside a transaction per migration (SQLAlchemy default) — a failure partway through a single migration rolls back that migration's own DDL automatically. But if migration `0015` fails *after* `0014` already committed, the database is left at `0014`, not `0013` — a real intermediate state to know about, not assume away.

| Symptom | Action |
|---|---|
| `alembic upgrade head` errors on `0014` | Database is still at `0013` (untouched). Fix the root cause (see below), retry `alembic upgrade head`. No restore needed. |
| Errors on `0015` (already past `0014`) | Database is at `0014`. Either fix and retry `alembic upgrade head` (it resumes from `0014`), or `alembic downgrade 0013` to fully unwind, then retry from Step 2. |
| Errors on `0016` (already past `0014`+`0015`) | Same pattern — `alembic downgrade 0013` to fully unwind, or fix-and-retry from `0015`. |
| Any migration errors with a **constraint violation** (e.g. `ck_tags_category` rejecting a seed row) | This would indicate a bug in the seed data itself, not a transient failure — **do not retry blindly**. Stop, report the exact error, treat it as a code defect requiring a fix before any retry. |
| Anything else unclear or alarming | `alembic downgrade 0013`, confirm `alembic current` shows `0013`, then restore from the Step 1 backup if `downgrade` itself is suspect: `./scripts/restore_db.sh <backup_file>`. |

### Rollback procedure (after a successful migration, if a later step fails)

Two options, in order of preference:

**Option A — Alembic downgrade** (preferred; all three migrations have tested `downgrade()`s):
```bash
cd api
alembic downgrade 0013
alembic current   # confirm: 0013
```
This drops `tags`, `venue_tags`, `collections`, `collection_venues`, and the two new `venues` columns/constraints, cleanly, in reverse order. **Correct choice if the migration applied cleanly but something *else* (Studio, publish, data classification) went wrong afterward.**

**Option B — Full restore from backup** (if the schema itself is suspect, or `downgrade` fails):
```bash
cd api
./scripts/restore_db.sh <backup_file_from_Step_1>
```
Type `yes` when prompted. **Only use this on an otherwise-untouched database** — per the script's own warning, replaying a dump into a non-empty database causes conflicts. If any real editorial work happened in Studio *after* the migration and *before* the rollback decision, Option B discards it; Option A does not (it only removes the new tables/columns, leaving all pre-existing venue/destination/event data untouched).

---

## 2. Verification SQL Pack

Ready to run immediately after Step 2, via `psql` or Supabase's SQL editor. Organized to match the QA checklist's own sections.

### 2a. Schema verification

```sql
-- Confirm every new table exists with the right shape
\d tags
\d venue_tags
\d collections
\d collection_venues
\d venues

-- Confirm constraints exist with the exact expected value lists
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname IN (
  'ck_tags_category', 'uq_tags_slug',
  'uq_collections_slug',
  'ck_venues_access_type', 'ck_venues_reservation_policy'
);

-- Confirm beach_details was NOT touched (kept temporarily, per decision)
SELECT conname FROM pg_constraint WHERE conname = 'ck_venues_beach_details_shape';
```

### 2b. Seed verification

```sql
-- Expect 28
SELECT COUNT(*) AS total_tags FROM tags;

-- Expect: Activity 5, Cafe 4, Nightlife 4, Restaurant 9, Shopping 6
SELECT category, COUNT(*) FROM tags GROUP BY category ORDER BY category;

-- Confirm the approved rename — must show 'beach-party' / 'Beach Party', never 'Beach Club'
SELECT slug, label FROM tags WHERE category = 'Nightlife' ORDER BY sort_order;

-- Duplicate slug check — expect zero rows
SELECT slug, COUNT(*) FROM tags GROUP BY slug HAVING COUNT(*) > 1;

-- Expect 7
SELECT COUNT(*) AS total_collections FROM collections;

-- Expect exactly: editors-choice, trending, summer-picks, hidden-gems,
-- best-sunset, family-favorites, beachfront-dining — all is_active = true
SELECT id, slug, name, is_active, sort_order FROM collections ORDER BY sort_order;

-- Must NOT exist — "No QR" is computed, never seeded
SELECT * FROM collections WHERE slug = 'no-qr' OR name ILIKE '%no qr%';

-- Expect 0 (nothing assigned yet, pre-editorial-classification)
SELECT COUNT(*) FROM venue_tags;
SELECT COUNT(*) FROM collection_venues;
```

### 2c. Data integrity (run before AND after migration; diff the two results)

```sql
SELECT COUNT(*) AS total_venues FROM venues;
SELECT COUNT(*) AS total_destinations FROM destinations;
SELECT COUNT(*) AS total_events FROM events;

-- Per-status breakdown, to compare row-for-row (not just totals)
SELECT status, COUNT(*) FROM venues GROUP BY status ORDER BY status;
SELECT status, COUNT(*) FROM destinations GROUP BY status ORDER BY status;
SELECT status, COUNT(*) FROM events GROUP BY status ORDER BY status;
```
**No migration in this phase touches existing rows** (only adds columns/tables) — any difference here between pre- and post-migration counts is a real anomaly, not expected drift, and should stop the process for investigation before continuing.

### 2d. Taxonomy validation (run after real editorial classification — Step 7 of the original execution order — not immediately post-migration, when these will trivially all be empty/zero)

```sql
-- Cross-category tag assignment — MUST return zero rows
SELECT v.id, v.name, v.category AS venue_category, t.label AS tag_label, t.category AS tag_category
FROM venue_tags vt
JOIN venues v ON v.id = vt.venue_id
JOIN tags t ON t.id = vt.tag_id
WHERE v.category != t.category;

-- Access Type — must only ever be NULL or one of the 5 values (the CHECK
-- constraint already guarantees this at write time; this is a read-side
-- sanity check, not a substitute for it)
SELECT access_type, COUNT(*) FROM venues GROUP BY access_type ORDER BY access_type NULLS FIRST;

-- Reservation Policy — same reasoning, must only be NULL/'Required'/'Recommended'
SELECT reservation_policy, COUNT(*) FROM venues GROUP BY reservation_policy ORDER BY reservation_policy NULLS FIRST;

-- Orphaned venue_tags rows (venue or tag deleted out from under the join) — expect zero
SELECT vt.* FROM venue_tags vt
LEFT JOIN venues v ON v.id = vt.venue_id
LEFT JOIN tags t ON t.id = vt.tag_id
WHERE v.id IS NULL OR t.id IS NULL;

-- Same for collection_venues — expect zero
SELECT cv.* FROM collection_venues cv
LEFT JOIN venues v ON v.id = cv.venue_id
LEFT JOIN collections c ON c.id = cv.collection_id
WHERE v.id IS NULL OR c.id IS NULL;
```

### 2e. Tag validation report

```sql
-- Every tag, its category, and how many venues carry it — unused tags show 0
SELECT t.id, t.slug, t.label, t.category, COUNT(vt.venue_id) AS assigned_venue_count
FROM tags t
LEFT JOIN venue_tags vt ON vt.tag_id = t.id
GROUP BY t.id, t.slug, t.label, t.category
ORDER BY t.category, t.sort_order;

-- Unused tags specifically
SELECT t.category, t.label
FROM tags t
LEFT JOIN venue_tags vt ON vt.tag_id = t.id
WHERE vt.tag_id IS NULL
ORDER BY t.category, t.label;

-- Duplicate tags (shouldn't be possible — uq_tags_slug blocks it — defensive check)
SELECT slug, COUNT(*) FROM tags GROUP BY slug HAVING COUNT(*) > 1;

-- Invalid assignments — identical to 2d's cross-category query, repeated here
-- since it's specifically a *tag* validation concern too
SELECT v.id, v.name, v.category AS venue_category, t.label, t.category AS tag_category
FROM venue_tags vt
JOIN venues v ON v.id = vt.venue_id
JOIN tags t ON t.id = vt.tag_id
WHERE v.category != t.category;
```

### 2f. Data coverage report (per category)

```sql
SELECT
  v.category,
  COUNT(DISTINCT v.id) AS total_venues,
  COUNT(DISTINCT vt.venue_id) AS tagged_venues,
  ROUND(100.0 * COUNT(DISTINCT vt.venue_id) / NULLIF(COUNT(DISTINCT v.id), 0), 1) AS pct_tagged
FROM venues v
LEFT JOIN venue_tags vt ON vt.venue_id = v.id
GROUP BY v.category
ORDER BY v.category;
```
This is the query that produces the "Restaurant — 112 venues, 109 tagged, 97%" shape from the requested report — do not hand-compute or estimate these numbers; this query is the only source of truth for them.

### 2g. Collection coverage

```sql
SELECT c.id, c.name, COUNT(cv.venue_id) AS assigned_venue_count
FROM collections c
LEFT JOIN collection_venues cv ON cv.collection_id = c.id
GROUP BY c.id, c.name, c.sort_order
ORDER BY c.sort_order;

-- Empty collections specifically
SELECT c.id, c.name
FROM collections c
LEFT JOIN collection_venues cv ON cv.collection_id = c.id
WHERE cv.venue_id IS NULL;
```

### 2h. Access Type distribution

```sql
SELECT COALESCE(access_type, 'NULL') AS access_type, COUNT(*) AS venue_count
FROM venues
GROUP BY access_type
ORDER BY venue_count DESC;
```

---

## 3. API Verification Script

Every request below assumes a valid Studio session token for `/editor/*` calls (`Authorization: Bearer <token>`) and no auth for `/public/*`. Replace `{BASE}` with the API's base URL, `{TOKEN}` with a real Studio token, and any `{id}`/`{slug}` placeholders with real values once seed/classification data exists.

| # | Request | Expected Response |
|---|---|---|
| 1 | `GET {BASE}/editor/tags?category=Restaurant` (auth) | `200`, JSON array of exactly 9 `TagOut` objects (`id, slug, label, category, sort_order`), all `category: "Restaurant"` |
| 2 | `GET {BASE}/editor/tags?category=Cafe` (auth) | `200`, exactly 4 objects |
| 3 | `GET {BASE}/editor/tags` (no `category`, auth) | `200`, all 28 tags |
| 4 | `GET {BASE}/editor/tags` (no auth header) | `401` |
| 5 | `GET {BASE}/editor/collections` (auth) | `200`, exactly 7 `CollectionOut` objects, all `is_active: true` |
| 6 | `PATCH {BASE}/editor/venues/{id}` with `{"tag_ids": [<valid Restaurant tag id>]}`, `If-Match: <version>` (auth, venue is category `Restaurant`) | `200`, returned `VenueOut.tags` contains that tag's slug |
| 7 | Same as #6 but with a `Cafe`-category tag id on a `Restaurant` venue | `422`, `{"error": "tag_category_mismatch", ...}` |
| 8 | `PATCH {BASE}/editor/venues/{id}` with `{"tag_ids": [999999]}` (a nonexistent id) | `422`, `{"error": "invalid_tag_ids", ...}` |
| 9 | `PATCH {BASE}/editor/venues/{id}` with `{"collection_ids": ["editors-choice"]}` | `200`, `VenueOut.collections` contains `"editors-choice"` |
| 10 | `PATCH {BASE}/editor/venues/{id}` with `{"collection_ids": ["not-a-real-id"]}` | `422`, `{"error": "invalid_collection_ids", ...}` |
| 11 | `PATCH {BASE}/editor/venues/{id}` with `{"access_type": "Public"}` | `200`, `VenueOut.access_type == "Public"` |
| 12 | `PATCH {BASE}/editor/venues/{id}` with `{"access_type": "Not A Real Value"}` | `422`, `{"error": "invalid_access_type", ...}` |
| 13 | `PATCH {BASE}/editor/venues/{id}` with `{"reservation_policy": "Required"}` | `200`, `VenueOut.reservation_policy == "Required"` |
| 14 | `PATCH {BASE}/editor/venues/{id}` with `{"reservation_policy": "Sometimes"}` | `422`, `{"error": "invalid_reservation_policy", ...}` |
| 15 | `GET {BASE}/public/venues/{id}` (a published venue with tags/access_type set, no auth) | `200`, response includes `"tags": [...]`, `"access_type": "..."`, `"reservation_policy": ...`, and **no** `"collections"` key at all (removed from `PublishedVenueOut` by design) |
| 16 | `GET {BASE}/public/search/venues?tags=seafood,sushi` | `200`, every returned venue has *at least one* of `seafood`/`sushi` in its `tags` — confirms **OR**, not AND |
| 17 | `GET {BASE}/public/search/venues?accessType=Public` | `200`, every returned venue has `access_type == "Public"` exactly |
| 18 | `GET {BASE}/public/search/venues?category=Restaurant&tags=seafood` | `200`, AND-combined with the tag OR-group — every result is `category == "Restaurant"` AND has the `seafood` tag |
| 19 | `GET {BASE}/public/discover/no-qr` | `200`, zero venues with `access_type == "QR Required"`; venues with `access_type: null` **are** included |
| 20 | `GET {BASE}/public/collections/editors-choice` (or another collection with real members) | `200`, `PublishedCollectionOut` shape (`id, slug, name, description, venues`), `venues` is an array of full `PublishedVenueOut` objects in the curated order |
| 21 | `GET {BASE}/public/collections/hidden-gems` (a collection with **zero** assigned venues) | `200`, `"venues": []` — not a `404` |
| 22 | `GET {BASE}/public/collections/not-a-real-slug` | `404` |

Suggested execution: a small script (curl loop, Postman collection, or `httpx` script) running all 22 in sequence, asserting status code + key response shape per row — not manual clicking, since this needs to be re-runnable identically after every future migration too.

---

## 4. Admin Studio Verification Guide

Manual QA — walk through in order, in a real browser session against the migrated environment.

1. **Login** and navigate to any `Restaurant`-category venue's workspace.
2. **Basic Information section** — confirm two new fields appear: "Access Type" and "Reservation Policy," each a dropdown with a blank/"not set" option plus the real values. Select "Public," Save Draft, confirm it persists after a full page reload.
3. **"Tags & Collections" section** — confirm it renders below Basic Information (and above Beach Details, if present). Confirm the Tags column header reads "Tags — Restaurant" and lists exactly the 9 Restaurant tags (Seafood, Sushi, Italian, Grill, Mandi & Kabsa, Burgers, Pizza, Sandwiches, Fast Food).
4. Check "Seafood" — confirm it **saves immediately** (no Save Draft click needed, no dirty-state indicator triggered) and a brief "Saving…" indicator appears then clears.
5. Reload the page — confirm "Seafood" is still checked (persisted, not just local state).
6. Uncheck "Seafood" — confirm it un-persists the same way.
7. Open a `Cafe`-category venue — confirm the Tags column now shows exactly the 4 Coffee tags, not Restaurant's.
8. In the Collections column, check "Editor's Choice" and "Trending" simultaneously on one venue — confirm both persist independently; unchecking one doesn't affect the other.
9. **Category switch check**: on a venue with tags already assigned, change its Category (Basic Information → Save Draft) to a different category. Confirm the Tags & Collections section now shows the *new* category's tag list, and the previously-assigned (now mismatched) tags no longer appear checked — this is the documented Phase 1 limitation, confirm it fails *gracefully* (no crash, no stale-wrong display), not that the old tags are silently still "on" somewhere invisible.
10. Confirm **no** Collections management screen exists anywhere in Studio's navigation (no "create collection" button, no collection-editing page) — Phase 1 is assignment-only, verify that boundary held.
11. **Regression pass** — Publishing page, Activity log, Users page, Quality Center, and Map explorer each still load and function normally (none of these were meant to change).
12. Venue list page — confirm it still loads at normal speed with real data (checks the `_attach_taxonomy` N+1-per-row addition didn't introduce a visible slowdown at real venue counts).
13. Run a **bulk action** (e.g. bulk-approve 2–3 venues that have tags/collections assigned) — confirm the returned venues in the bulk result still show correct `tags`/`collections` in the response (not blanked out by the bulk path).

---

## 5. Publish Verification Guide

1. **Pre-publish state check**: confirm at least 2–3 venues across at least 2 categories have `status = 'approved'`, their destinations are also `approved`, and each has at least one tag, an `access_type`, and membership in at least one collection (from Studio verification above).
2. **Trigger Publish**: `POST /editor/publish` (Studio's Publish button, or the API directly). Note the wall-clock time from request to response — this is the Publish Duration figure for the eventual Performance report; don't estimate it, time it.
3. **Verify the response**: `PublishRevisionOut` — `venue_count`/`destination_count` match the approved-and-closure-eligible counts from step 1 (not necessarily every approved venue, if any have an unapproved destination — that's expected exclusion behavior, already covered by existing tests).
4. **Inspect the raw snapshot**: `GET /editor/publish/revisions/{id}` (returns `PublishRevisionDetail`, including the full `snapshot` JSONB).
   - Confirm `snapshot["venues"]` entries include `tags`/`access_type`/`reservation_policy` matching exactly what Studio showed.
   - Confirm `snapshot["collections"]` is present, is an array, and includes **all 7** collections (even ones with zero members — `"venue_ids": []`, not omitted).
   - For a collection with 2+ members, confirm `venue_ids` order matches the order they were assigned (or at least is stable/deterministic, since Phase 1 has no reordering UI — all `sort_order = 0`, so order will reflect assignment/insertion order; confirm it isn't randomly shuffled between publishes).
5. **Record Snapshot Size**: `SELECT pg_column_size(snapshot) FROM publish_revisions WHERE id = <new_revision_id>;` (bytes) — compare against the prior revision's size (same query, prior `id`) once both exist, for the Publish Performance report.
6. **Referential closure check** (the one edge case worth deliberately constructing, not just hoping holds): assign a venue to a collection, then either un-approve that venue or its destination, Publish again, and confirm that venue's id is **absent** from the collection's `venue_ids` in the new snapshot — proving the closure filter in `_serialize_collections` actually works, not just that it compiles.
7. **Republish check**: pick an older revision, `POST /editor/publish/revisions/{id}/republish`, confirm it succeeds and flips `is_current` without rebuilding/touching the snapshot content (a pure pointer-move — confirm the snapshot content is byte-identical to what it was when that revision was first created).
8. **Public read-through**: after publishing, immediately hit `GET /public/venues`, `GET /public/search/venues`, `GET /public/discover/no-qr`, `GET /public/collections/{slug}` (per §3 above) and confirm they reflect the just-published data, not a stale prior revision.

---

## 6. Production Rollback Guide

Consolidated from §1, restated as a single incident-response reference — use this if something is discovered wrong *after* the migration + verification already appeared to succeed (i.e., a problem found during Studio/publish verification, not during the migration command itself).

### Decision tree

```
Something is wrong. How wrong?
│
├─ Schema/data looks structurally broken (wrong constraint, corrupted
│  seed data, migration logic itself was flawed)
│  → Option A: alembic downgrade 0013, fix the migration file, re-apply.
│    Safe: no real editorial data existed in the new tables yet if this
│    is caught early (seed-only state).
│
├─ Schema is fine, but real editorial work (tag/collection assignments,
│  access types) happened and something about IT is wrong
│  → Do NOT downgrade — that destroys the new columns/tables and the
│    editorial work in them. Fix forward: correct the bad data via
│    direct SQL UPDATE/DELETE against the specific bad rows, using the
│    Verification SQL Pack (§2) queries to first identify exactly which
│    rows are affected. Never a blind downgrade once real data exists
│    in the new tables.
│
├─ A bad Publish went out (wrong snapshot reached Consumer/public API)
│  → Republish a known-good prior revision:
│    POST /editor/publish/revisions/{previous_good_id}/republish
│    This is instant and doesn't touch the database schema at all —
│    always try this before any DB-level rollback for a "bad publish"
│    symptom specifically.
│
└─ Total uncertainty / suspected data corruption beyond the new tables
   → Full restore: ./scripts/restore_db.sh <Step 1 backup file>
     Last resort — discards everything since the backup, including any
     unrelated editorial work done in the meantime. Get explicit
     sign-off before using this option specifically.
```

### Rollback command reference

```bash
# Schema-only rollback (safe if no real data in new tables yet)
cd api && alembic downgrade 0013 && alembic current   # confirm: 0013

# Publish-level rollback (a bad snapshot went live, schema is fine)
curl -X POST {BASE}/editor/publish/revisions/{previous_good_id}/republish \
  -H "Authorization: Bearer {TOKEN}"

# Full restore (last resort)
cd api && ./scripts/restore_db.sh <backup_file>
# Requires typing 'yes' at the interactive prompt — cannot be scripted
# non-interactively, deliberately (see restore_db.sh's own comments).
```

### After any rollback

- [ ] `alembic current` confirms the expected revision.
- [ ] Re-run §2a (schema verification) to confirm the rollback left a clean state, not a partial one.
- [ ] Document what went wrong and why the rollback was needed — this becomes input to fixing the actual root cause before re-attempting the migration, not just retrying blindly.

---

## What Happens Next

This document is preparation only — **nothing in it has been executed.** Once someone runs §1 (backup + migrate) for real:

1. Run §2's SQL pack in full, recording every actual result.
2. Run §3's API script in full, recording every actual response.
3. Run §4's Studio walkthrough.
4. Run §5's publish verification, recording real timings and sizes.
5. Only then should the **Production Readiness Report** (Data Integrity, Publish Snapshot Comparison, API Performance, Publish Performance, Data Validation, Tag Validation, Coverage, Collection Coverage, Access Type Distribution, and the final Phase 1 Completion Report) be generated — from those real, recorded results, never estimated or fabricated.

No code was modified, no migrations were created or run, to produce this document.
