# SahelSpot — Phase 1 Handover
### Category → Tags → Access Type → Badges → Collections

**Status: Code complete. Database migration pending.** This document is the official reference for Phase 1. It is written so an engineer with no prior context can understand what was built, why, and exactly what remains — without reading any chat history or prior planning documents.

---

## 1. Executive Summary

Phase 1 replaces SahelSpot's original plan for Home-category filtering — a set of dedicated database columns per category (`coffee_type`, `restaurant_cuisine`, `shopping_type`, `nightlife_type`, `family_amenities`, `quick_bites_type`) — with a general-purpose taxonomy architecture: **Category → Tags → Access Type → Badges → Collections**.

The original driver was a UX requirement: Home screen categories (Beaches, Coffee, Quick Bites, Restaurants, Family, Nightlife, Shopping, plus a new "No QR" discovery category) needed their own dedicated filters, replacing a single generic filter bar shared across every category. Implementing that literally — one new column per category, per filter — would have meant a database migration every time a new filter was added to any category, indefinitely. That was identified as an architectural weakness before any code was written.

The selected architecture solves this by separating concerns that don't actually change at the same rate:

- **Category** is stable and rarely changes — it stays exactly what it already was (a `TEXT` column, CHECK-constrained, unchanged from before Phase 1).
- **Tags** are category-scoped and expected to grow — they became a real database table instead of columns, so adding a new tag is a data `INSERT`, never a schema migration.
- **Access Type** and **Reservation Policy** are small, stable, cross-category concepts — they stayed as plain columns, since a lookup table would be over-engineering for a fixed 5-value and 2-value set respectively.
- **Collections** are editorial curation, not a venue property at all — a genuinely separate many-to-many concept (a venue doesn't "have" a collection the way it "has" a category).

This architecture was chosen specifically to minimize future database migrations while keeping the Admin Studio experience simple — the explicit priority set before implementation began. It also resolved two problems discovered during architecture review that weren't part of the original ask: "Quick Bites" had no real underlying Studio category (it's now just Restaurant venues carrying Quick Bites tags), and Access Type was originally going to be nested inside the Beach-only `beach_details` field, which would have inherited a pre-existing data-mapping bug (real beach venues are filed under the `Beach Club` category, not `Beach`).

**What Phase 1 delivers:** the complete database schema, backend API, publish pipeline integration, and Admin Studio UI for this architecture — fully coded, fully tested against the existing test suite structure, builds clean across all three applications. **What Phase 1 does not yet include:** the migration has not been applied to any real database, no venue has been classified with real tag/access-type/collection data, and no Consumer-facing UI exists yet (explicitly out of scope — see §10).

---

## 2. Architecture Overview

```
Venue
  │
  ├─ Category            (WHAT this place fundamentally is — stable)
  │
  ├─ Tags                (its characteristics WITHIN that category — grows over time)
  │
  ├─ Access Type          (how you get in — cross-category, independent of Category)
  │
  ├─ Badges               (display-only signals — never a filter)
  │
  └─ Collections          (editorial curation — cross-category, many-to-many, ordered)
```

### Layer responsibilities

| Layer | What it answers | Cardinality | Storage |
|---|---|---|---|
| **Category** | "What kind of place is this?" (Restaurant, Cafe, Beach, ...) | Exactly one per venue | `venues.category` — unchanged, pre-existing `TEXT` column, CHECK-constrained against 13 fixed values |
| **Tags** | "What are its specific characteristics within that category?" (Seafood, Specialty Coffee, DJ, ...) | Zero or many per venue, scoped to its category | New `tags` table + `venue_tags` join table |
| **Access Type** | "How does a visitor get in?" (Public, Paid Entry, QR Required, ...) | Exactly one or none, applies uniformly to every category | New `venues.access_type` column |
| **Badges** | "What should a visitor notice at a glance?" (Reservation Required/Recommended) | Display-only, never used for filtering | New `venues.reservation_policy` column (the only badge implemented in Phase 1 — see §10) |
| **Collections** | "What editorially curated group is this venue part of?" (Editor's Choice, Best Sunset, ...) | Zero or many per venue, independent of category | New `collections` table + `collection_venues` join table |

### Why this architecture over category-specific columns

A dedicated column per category-filter (the originally proposed approach) means every new filter — even a single new tag value like "Halal" under Restaurant — requires a database migration: a schema change, a deploy, a rebuild. That cost compounds with every category the product adds.

Tags-as-a-table inverts that cost: a new tag is a row insert, not a schema change. Category stays a column because it doesn't have this growth problem — it's a small, fixed, rarely-changing set, exactly like `CONTENT_STATUSES` and other closed vocabularies already used elsewhere in this schema. Access Type and Reservation Policy stay columns for the same reason — they are fixed, small, and cross-category, so the "avoid future migrations" argument that justifies Tags-as-a-table doesn't apply to them. Collections are a separate many-to-many concept because they answer a fundamentally different question ("what editorial grouping" vs. "what characteristic") and can span categories in ways Tags structurally cannot.

---

## 3. Database Changes

### Existing tables (unchanged in structure, only extended)

- **`venues`** — two new nullable columns added (see below); every pre-existing column, index, and constraint (including `beach_details` and its shape constraint) is untouched.

### New tables

**`tags`**
| Column | Type | Notes |
|---|---|---|
| `id` | `INTEGER`, identity PK | |
| `slug` | `TEXT`, unique | e.g. `"seafood"` |
| `label` | `TEXT` | e.g. `"Seafood"` |
| `category` | `TEXT` | CHECK-constrained against the same 13-value category set as `venues.category` — scopes each tag to one category |
| `sort_order` | `INTEGER`, default `0` | |

**`venue_tags`** (many-to-many join, no payload)
| Column | Type | Notes |
|---|---|---|
| `venue_id` | `TEXT`, FK → `venues.id` | `ON DELETE CASCADE`; part of composite PK |
| `tag_id` | `INTEGER`, FK → `tags.id` | `ON DELETE RESTRICT`; part of composite PK |

**`collections`**
| Column | Type | Notes |
|---|---|---|
| `id` | `TEXT` PK | Convention: id = slug, matching `Destination`'s own PK-is-the-slug pattern |
| `slug` | `TEXT`, unique | |
| `name` | `TEXT` | |
| `description` | `TEXT`, nullable | |
| `is_active` | `BOOLEAN`, default `true` | Inactive collections are excluded from publish |
| `sort_order` | `INTEGER`, default `0` | |
| `created_at`/`updated_at` | `TIMESTAMPTZ` | |

**`collection_venues`** (many-to-many join, **with** payload)
| Column | Type | Notes |
|---|---|---|
| `collection_id` | `TEXT`, FK → `collections.id` | `ON DELETE CASCADE`; part of composite PK |
| `venue_id` | `TEXT`, FK → `venues.id` | `ON DELETE CASCADE`; part of composite PK |
| `sort_order` | `INTEGER`, default `0` | Curated order within the collection — the one structural difference from `venue_tags`, which has no such column since tag membership is an unordered set |

### New columns on `venues`

| Column | Type | Constraint |
|---|---|---|
| `access_type` | `TEXT`, nullable | `IN ('Public', 'Paid Entry', 'QR Required', 'Residents Only', 'Hotel Guests Only')` or `NULL` |
| `reservation_policy` | `TEXT`, nullable | `IN ('Required', 'Recommended')` or `NULL` |

### Relationships

- `venue_tags` and `collection_venues` are the only new relationships — both plain many-to-many joins. No ORM `relationship()` declarations were added to `Venue`; the codebase's existing convention (direct, explicit queries rather than relationship traversal — see `AppUser`'s own documented reasoning) was followed for consistency.
- `tags.category` and `venues.category` share the same fixed vocabulary but are not foreign-keyed to each other — both independently CHECK-constrained against the same value set, matching how `CONTENT_STATUSES` is already shared across `destinations`/`venues`/`events` without a lookup table.

### Migration numbers

| Revision | File | Contents |
|---|---|---|
| `0014` | `api/alembic/versions/0014_tags.py` | Creates `tags` + `venue_tags`; seeds **28 tags** across 5 categories |
| `0015` | `api/alembic/versions/0015_collections.py` | Creates `collections` + `collection_venues`; seeds **7 collections** |
| `0016` | `api/alembic/versions/0016_venue_access_reservation.py` | Adds `venues.access_type` + `venues.reservation_policy` + their CHECK constraints |

Chain: `0013 → 0014 → 0015 → 0016`. Confirmed via `alembic heads` (single head, `0016`, no branching) — see §7 for current applied revision.

**Deliberately deferred, not removed:** `venues.beach_details` and its `publicAccess` key remain exactly as they were before Phase 1 — kept temporarily for backward compatibility, to be removed in a later migration once Consumer no longer depends on it (Consumer changes are Phase 2+ scope).

---

## 4. API Changes

### New endpoints

| Method & Path | Auth | Purpose |
|---|---|---|
| `GET /editor/tags?category=` | Editor, `CONTENT_VIEW` | Read-only tag catalog, optionally scoped by category — feeds Studio's tag picker |
| `GET /editor/collections` | Editor, `CONTENT_VIEW` | Read-only collection catalog (all collections, active or not) — feeds Studio's collection picker |
| `GET /public/discover/no-qr` | None | Every published venue whose `access_type` is not `'QR Required'` (including `NULL` — unclassified defaults to visible) — computed at request time, never stored |
| `GET /public/collections/{slug}` | None | A single published collection with its venues resolved in curated order |

### Modified endpoints

- **`PATCH /editor/venues/{id}`** — the existing Save Draft endpoint now also accepts `access_type`, `reservation_policy` (plain fields, validated against their fixed vocabularies) and `tag_ids`/`collection_ids` (full-replace of the venue's many-to-many membership, not incremental add/remove). This was a deliberate decision — no dedicated `/tags` or `/collections` write endpoints were created; the existing venue update path was reused.
- **`GET /public/search/venues`** — two new optional query params: `tags` (comma-separated slugs, **OR** semantics — a venue matches if it has *any* of the requested tags) and `accessType` (exact match). Both AND-combine with the existing `q`/`category`/`destination` params.
- Every route that returns a `VenueOut` (list, get, create, update, and every bulk-action endpoint) now also populates `tags`/`collections` on the response.

### Validation

- `validate_access_type` / `validate_reservation_policy` (`api/app/validation/venues.py`) — reject an out-of-vocabulary value with a structured `422`, same pattern as the pre-existing `validate_beach_details_shape`.
- `validate_tag_ids` — rejects unknown tag ids, **and** rejects a tag whose `category` doesn't match the venue's resulting category (e.g. assigning a Coffee tag to a Restaurant venue is a `422 tag_category_mismatch`, not just hidden by the Studio picker UI).
- Collection id validation happens inline in the update route — an unknown collection id is a `422 invalid_collection_ids`.

### Serialization

- `VenueOut`, `VenueUpdate`, and `PublishedVenueOut` (Pydantic schemas) all gained `access_type`/`reservation_policy`/`tags` fields. `PublishedVenueOut` deliberately has **no** `collections` field — collection membership isn't embedded per-venue (see §6).
- New `TagOut`, `CollectionOut`, `PublishedCollectionOut` schemas.

### How taxonomy flows from database to published JSON

```
Studio assigns tags/access_type/reservation_policy/collections
        │  (PATCH /editor/venues/{id} — writes to venues, venue_tags, collection_venues)
        ▼
   Draft database rows (not yet visible anywhere public)
        │  Editor approves the venue (existing workflow, unchanged)
        ▼
   Publish action runs (POST /editor/publish)
        │  Reads venues + venue_tags + tags (batched, not per-venue) + collections + collection_venues
        ▼
   Frozen JSON snapshot (publish_revisions.snapshot)
        │  Each venue entry includes tags/access_type/reservation_policy;
        │  a top-level "collections" array holds every active collection's
        │  ordered venue-id list, filtered to only venues actually in this
        │  snapshot (referential closure)
        ▼
   /public/* endpoints read only this frozen snapshot, never the live tables
```

---

## 5. Admin Studio

### New capabilities

**Access Type** — a new dropdown in the existing "Basic Information" section, alongside Category. Five values plus a blank "not set" option. Saved through the normal Save Draft flow (Edit Mode → change → Save), same as every other Basic Information field.

**Reservation Policy** — same pattern, same section, two values ("Required"/"Recommended") plus blank.

**Tags** — a new "Tags & Collections" section, rendered on every venue's workspace, below Basic Information. Shows the venue's *own category's* tags only (e.g. a Restaurant venue sees exactly its 9 Restaurant tags — 5 cuisine tags plus 4 Quick Bites tags — never Coffee's or Shopping's). Each tag is a checkbox. **Toggling saves immediately** — this does not go through Edit Mode/Save Draft; it acts the same way removing a gallery image already does in this Studio (an immediate, standalone action).

**Collections** — the same section, a second column, listing all 7 seeded collections as checkboxes, also saving immediately on toggle. **Phase 1 is assignment-only** — there is no screen anywhere in Studio to create, rename, or delete a collection; that catalog is fixed (seeded by migration `0015`) until a future phase builds that management UI.

### How editors are expected to classify venues

For every venue, an editor should, as part of normal editorial review:

1. Open the venue's workspace.
2. In Basic Information, set **Access Type** if known (leave blank if genuinely unknown — do not guess).
3. Set **Reservation Policy** if applicable (most venues will leave this blank — it's exceptional, not universal).
4. In "Tags & Collections," check every tag that genuinely applies to the venue from its category's list.
5. Check any Collections the venue editorially belongs in, if applicable.

No step here blocks publishing — a venue with zero tags, no access type, and no collections is still fully publishable, exactly as it was before Phase 1. Classification is additive enrichment, not a new gate.

---

## 6. Publish Pipeline

Publishing (`api/app/publishing/engine.py`) is unchanged in its overall shape — it still gathers every currently-`approved` venue/destination, freezes them into an immutable snapshot, and atomically flips the `is_current` pointer. Phase 1 extends what gets embedded in that snapshot:

- **Venue serialization** — `_serialize_venue` now includes `access_type`, `reservation_policy`, and `tags` (an array of tag slugs, in `sort_order`) directly on each venue's snapshot entry. The tag lookup is batched once per publish (one query joining `venue_tags`→`tags` for every venue being published), not queried per-venue — an intentional performance choice to keep Publish's cost from scaling with N+1 queries as venues gain tags.
- **Collection serialization** — a new `_serialize_collections` function runs once per publish, independently of the venue loop. It embeds every `is_active` collection (even ones with zero members — they still appear, with an empty `venue_ids` array) as `{id, slug, name, description, venue_ids}`, with `venue_ids` already in curated `sort_order`.
- **Snapshot generation** — the snapshot's top-level shape gained one new key: `snapshot["collections"]`, alongside the pre-existing `destinations`/`venues`/`events`.
- **No QR computation** — deliberately **not** part of the snapshot at all. `GET /public/discover/no-qr` computes it at request time by filtering `snapshot["venues"]` for `access_type != 'QR Required'`. This was an explicit architecture decision: "No QR" is a query, not a stored collection, and must never be seeded as one.
- **Referential integrity** — a collection can reference a venue that isn't part of the current publish (e.g. approved into a collection, then later un-approved, or its destination un-approved). `_serialize_collections` filters `venue_ids` down to only venues actually present in this snapshot, the same closure discipline the publish engine already applied to venues-whose-destination-isn't-approved before Phase 1 existed.

---

## 7. Migration Status

**Code Complete:** ✅ Yes — database models, migrations, API, publish pipeline, and Admin Studio are all implemented, and independently verified this session (see the Phase 1 Release Audit for the full verification record: clean `tsc`/`oxlint`/`vitest`/`next build`/backend app-import checks, zero TODO/debug/dead code, clean migration chain).

**Database Migration Pending:** ⏳ Yes — not yet applied to any database.

**Alembic Current Revision:** `0013`

**Alembic Target Revision:** `0016`

**What still needs to happen, in order:**
1. Take a verified database backup (`api/scripts/backup_db.sh`) — **requires `pg_dump`, currently unavailable in the environment this Phase 1 work was done in**; must be run from a machine that has it, or that tooling must be installed first.
2. Confirm, explicitly, which database (dev/staging/production) is being targeted before running anything.
3. Apply migrations: `alembic upgrade head` (from `api/`).
4. Run the full verification procedure already prepared in `docs/PHASE1_DEPLOYMENT_KIT.md` (schema checks, seed checks, API checks, Studio walkthrough, publish verification).
5. Begin real editorial classification (§9).
6. Only after all of the above: Phase 2 (Consumer) may begin.

---

## 8. Deployment Plan

Summarized execution order (full detail in `docs/PHASE1_DEPLOYMENT_KIT.md`):

1. **Backup** — `api/scripts/backup_db.sh`, verify the output file is non-empty and restorable.
2. **Migration** — `alembic upgrade head`; confirm `alembic current` reports `0016`.
3. **Restart** — restart the API process/container so it picks up the new schema (no code redeploy needed beyond this — the backend code is already the version described in this document; restarting just re-establishes the DB connection pool against the now-migrated schema).
4. **QA** — execute the full `docs/PHASE1_DEPLOYMENT_KIT.md` verification pack: schema SQL, seed SQL, the 22-request API verification script, the Studio manual walkthrough, and the publish verification procedure.
5. **Publish** — trigger a real Publish once at least a few venues are classified, to prove the pipeline end-to-end with real data, not just seed data.
6. **Classification** — the real editorial work (§9) — this is ongoing, not a single event, and does not block Phase 2 from *starting*, only from *finishing* (see §12).
7. **Phase 2** — Consumer-facing work begins only once the above is verified, per your explicit standing instruction throughout this project.

---

## 9. Editorial Workflow

Examples, using the real seeded categories and tags:

```
Restaurant
    │
    ├─ Tags:  Seafood · Sushi · Italian · Grill · Mandi & Kabsa
    │         Burgers · Pizza · Sandwiches · Fast Food   (Quick Bites tags — same category)
    │
    ├─ Access Type:  Public / Paid Entry / QR Required / Residents Only / Hotel Guests Only
    │
    └─ Reservation Policy:  Required / Recommended  (only if actually applicable)

Coffee  (Studio category: "Cafe")
    │
    └─ Tags:  Specialty Coffee · Coffee Shop · Shisha · Desserts

Beach  (real venues are filed under Studio category "Beach Club", not "Beach" — see §11)
    │
    └─ Access Type:  QR Required / Public / Residents Only / Paid Entry / Hotel Guests Only
```

**Intended workflow:** classification happens as part of normal editorial review, not as a separate bulk project (though a bulk pass to backfill existing published venues is expected and reasonable — there is no bulk-classification endpoint built in Phase 1; it would use the same per-venue `PATCH` endpoint, once per venue). An editor reviewing or creating a venue should treat Access Type, Reservation Policy, and Tags as part of "is this venue's record complete," the same category of judgment call `is_featured`/`is_verified` already represent — informed by real knowledge of the venue, never guessed to fill a field. Leaving a field blank (`NULL`) is always a valid, honest state — better than a wrong guess.

---

## 10. Known Limitations

Explicitly out of scope for Phase 1, by design, not oversight:

- **Consumer UX** — no Consumer-facing category pages, filters, "No QR" page, or collection rails exist yet. Phase 1 is backend + Studio only.
- **Collections Management UI** — no create/rename/delete-collection screen in Studio. The 7 seeded collections are fixed until a future phase builds this.
- **Tag CRUD** — no create/rename/delete-tag screen in Studio either. The 28 seeded tags are fixed for the same reason.
- **Advanced taxonomy management** — no tag reordering UI, no collection-venue reordering UI (the `sort_order` columns exist and are read/respected by publish, but nothing in Studio lets an editor change them yet — every assignment currently lands at `sort_order = 0`).
- **Bulk classification tooling** — no dedicated "bulk-assign this tag to N venues" action; classification is one venue at a time via the existing per-venue endpoint.
- **`beach_details.publicAccess` removal** — deliberately kept, not removed, pending Consumer no longer needing it.
- **"Coming Soon" badge** — mentioned in earlier planning as a possible badge type, explicitly skipped for this phase (no matching field exists).

---

## 11. Technical Debt

**Immediate** (worth knowing before Phase 2, not urgent to fix now):
- Category-switch edge case: if a venue's `category` changes via Basic Information, previously-assigned tags from the *old* category are not automatically cleared — they simply stop appearing checked in the picker (which only ever shows the current category's tag list) until explicitly reassigned. Documented, not fixed, in Phase 1.
- The `Beach` vs. `Beach Club` category mismatch (real beach venues are filed under `Beach Club`; `Beach` has no real venues) predates Phase 1 but is directly relevant to Access Type classification for beaches — worth resolving before large-scale beach classification work.

**Future:**
- No repository/data-access abstraction layer for the new tables (direct queries throughout, matching this codebase's existing convention — not a defect, but worth knowing before any future caching layer is considered).
- No log aggregation, error tracking, rate limiting, or uptime monitoring exist anywhere in the platform (pre-existing gaps, unrelated to Phase 1, already tracked in `docs/PRODUCTION_READINESS.md`).

**Optional:**
- `venue_tags`/`collection_venues` have no `created_at`/`updated_at` columns — fine for Phase 1's needs (no audit trail requirement stated), would be a one-line addition if that need arises later.
- No Python linter is configured for the `api/` project at all (pre-existing, confirmed during the Phase 1 release audit — not introduced by this phase).

---

## 12. Phase 2 Prerequisites

Every item below must be complete before Phase 2 (Consumer) begins — nothing here is optional or assumed:

- [ ] Database backup taken and verified restorable.
- [ ] Migrations `0014`–`0016` applied to the target database; `alembic current` confirms `0016`.
- [ ] Full `docs/PHASE1_DEPLOYMENT_KIT.md` verification pack executed and passed (schema, seed, API, Studio, publish).
- [ ] At least one successful real Publish with real (non-seed-only) tag/access-type/collection data, confirmed correct in the resulting snapshot.
- [ ] A meaningful proportion of live venues classified — enough that Consumer's category pages/filters would show real, non-empty results at launch (exact threshold is a product decision, not specified here — but "zero venues classified" is not launch-ready for any category-filtered UI).
- [ ] The Production Readiness Report (Data Integrity, Snapshot Comparison, API/Publish Performance, Data Validation, Tag/Collection/Access-Type coverage, Final Completion Report) generated from real post-migration data, per the process already agreed.
- [ ] Explicit sign-off recorded that Phase 1 is formally closed.

---

## 13. Final Status

```
Phase 1 Development        ✅ Complete
Database Migration         ⏳ Pending
Editorial Classification   ⏳ Not Started (blocked on migration)
Consumer UX                ⏳ Not Started (Phase 2 scope)
Production Ready           ⏳ Waiting for Migration
```

---

## 14. Recommendations

Execution-order guidance only — no architectural or feature suggestions:

1. Resolve the backup-tooling gap (`pg_dump`/`psql` availability) before anything else — it's the single blocking dependency for every subsequent step.
2. Get explicit, written confirmation of which database environment is being targeted before running the migration — this was flagged twice during Phase 1 and should not be assumed at execution time.
3. Run the migration and the full deployment-kit verification pack in one sitting, rather than spread across sessions — the verification queries are cheapest to interpret correctly immediately after migration, while the expected pre/post state is freshest.
4. Do not begin real editorial classification at scale until the verification pack has fully passed — classify a small number of venues first, publish, and verify the snapshot end-to-end (§6) before committing to a full classification pass.
5. Resolve the `Beach`/`Beach Club` category question (§11) before large-scale Access Type classification of beach venues specifically, since it directly affects which venues that classification work should target.
6. Do not start Phase 2 planning or implementation until every item in §12 is checked off.

---

*This document reflects Phase 1's state as of the code-complete point described above. Any change to the architecture, schema, or API surface described here should come with a revision of this document, not a separate, disconnected one.*
