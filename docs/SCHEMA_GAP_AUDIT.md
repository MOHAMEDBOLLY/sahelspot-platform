# Schema & Feature Gap Audit — Legacy DataLab → SahelSpot Platform

**Type:** Architectural review. No code, schema, or data was modified.
**Date:** 2026-07-28
**Scope:** Legacy DataLab (`server.py` + v1.6.1 UI), current API, current
database schema, current React Studio (`datalab-next`), and the
`production_dataset_v18.json` export.

---

## 1. Executive summary

The new platform is **not** an incomplete copy of the legacy DataLab. It is a
deliberate re-scoping: `docs/DATABASE.md` states outright that it models
**"the product … not the DataLab tool that assembled the data behind it."**
That single sentence explains the majority of apparent gaps, and it is a
defensible architectural position.

**The critical finding of this audit is not a missing feature — it is a
taxonomy collision.**

`venues.category` is constrained by a `CHECK` to nine values chosen from a
product brief and a review of the source data's *"63 raw category strings"*.
The reasoning recorded in `docs/DATABASE.md` was that the source mess was
*"almost entirely at the subtype level"* — that "seafood restaurant" and
"italian restaurant" are both just `Restaurant`. **That reasoning was correct
for the data it was written against, and is no longer correct today.** In the
intervening period DataLab curated its raw strings down to a clean, flat,
11-value taxonomy — and four of those eleven (`Activity`, `Spa`,
`Beach Club`, `Resort`) are **not subtypes of anything in the nine**. They are
peer-level concepts with no home.

This affects **107 of 426 venues (25.1%)**. It is not a data-quality problem
to be cleaned up; it is two taxonomies designed independently against
different snapshots of reality. No migration can proceed until it is resolved,
and resolving it by force-mapping would silently destroy a real editorial
distinction across a quarter of the catalogue.

Secondary findings:

- **Three product fields were dropped without a recorded decision** —
  `externalLink`, `rating`, `reviews`. Unlike `geo`/`qa_flags`/`merge_history`,
  these do **not** appear in the "Explicitly excluded" list. They appear to
  have been overlooked rather than rejected. Practical impact today is near
  zero (1, 0, and 0 populated records respectively), so this is a
  documentation gap more than a data-loss risk.
- **The Studio is materially less capable than the tool it replaces.** The
  database exclusion of curation tooling is sound; the *consequence* — that
  the replacement editorial tool cannot perform curation the legacy tool
  performed daily — was never separately designed. Dashboard and Settings are
  literal placeholders, and Publishing is browse-only despite the API fully
  supporting publish and republish.
- **`beach_details` is a column with no writer.** Beaches were correctly
  folded into `venues`, but nothing in the API, Studio, or import path can
  populate the JSONB column that was created to hold beach-only facts.

**Verdict: (B) — the platform needs schema additions before migration.**
Detail in §9.

---

## 2. Entity comparison

Legend — **Removed (intentional)**: named in a design decision or the
"Explicitly excluded" list in `docs/DATABASE.md`. **Missing (undocumented)**:
absent from both the schema and every recorded decision.

### 2.1 Venue

| Legacy field | New field | Status | Replacement | Data loss | Recommended action |
|---|---|---|---|---|---|
| `id` | `venues.id` (text PK) | ✅ Present | — | None | Preserve verbatim |
| `vslug` | `slug` | ✅ Present | — | None | Preserve; `UNIQUE(destination_id, slug)` verified satisfiable |
| `name` | `name` | ✅ Present | — | None | — |
| `destSlug` | `destination_id` (FK) | ✅ Present | — | None | Reconcile by slug |
| `destination` (display) | — | Removed (intentional) | `destination_id` → join | None (derivable) | None |
| `district` | `district` (text) | ✅ Present | — | None | — |
| `category` | `category` (CHECK, 9 values) | ⚠️ **COLLISION** | Partial only | **107 venues (25%)** | **§6.1 — blocking** |
| `lat` / `lng` | `latitude` / `longitude` `Numeric(9,6)` | ✅ Present | — | 7th decimal truncated (~11 cm) | Accept |
| `shortDesc` | `short_description` | ✅ Present | — | None | — |
| `rating` | — | ❌ **Missing (undocumented)** | None | None today (null ×426) | Document as excluded |
| `reviews` | — | ❌ **Missing (undocumented)** | None | None today (null ×426) | Document as excluded |
| `mapsUrl` | `maps_url` | ✅ Present | — | None | — |
| `website` | `website` | ✅ Present | — | None | — |
| `externalLink` | — | ❌ **Missing (undocumented)** | `website` (semantically different) | 1 record | Decide: fold into `website` or document |
| `instagram` | `instagram_handle` | ✅ Present | — | None | — |
| `facebook` | `facebook_handle` | ✅ Present | — | None | — |
| `tiktok` | `tiktok_handle` | ✅ Present | — | None | — |
| `phone` / `whatsapp` | `phone` / `whatsapp` | ✅ Present | — | None | — |
| `coverUrl` | `cover_image_url` | ✅ Present | — | None | — |
| `gallery` | `gallery_image_urls` `text[]` | ✅ Present | — | None (empty ×426) | — |
| `geo` (object) | — | Removed (intentional) — listed as `boundaryReviews` | None | **Full review history** | §6.3 |
| — | `status` | 🆕 Required, no source | — | — | Policy: `draft` |
| — | `is_featured`, `is_verified` | 🆕 Server default `false` | — | — | Accept |
| — | `opening_hours` JSONB | 🆕 No source | — | — | Leave null |
| — | `beach_details` JSONB | 🆕 **No writer exists** | — | — | §6.4 |
| — | `internal_notes`, `source` | 🆕 No source | — | — | Consider `source` for provenance |
| — | `last_published_at`, `created_at`, `updated_at` | 🆕 Managed | — | — | — |

### 2.2 Destination

| Legacy field | New field | Status | Data loss | Recommended action |
|---|---|---|---|---|
| `id` (`dest00009`) | `id` (text PK) | ⚠️ Identity conflict | — | Reconcile by slug (per policy) |
| `slug` | — (becomes `id`) | ✅ Preserved as PK | None | — |
| `name` | `name` | ✅ Present | None | — |
| `region` | `region` **NOT NULL** | ⚠️ Required, null in all 25 | — | **Blocking — §8.2** |
| `shortDesc` | — | ❌ Missing (undocumented) | None (null ×25) | Document |
| `coverUrl` | `cover_image_url` | ✅ Present | None | — |
| `boundary` | `boundary` JSONB | ✅ Present | None | Import 10 polygons |
| `venueCount` | — | Removed (intentional) | None (derivable) | Compute on read |
| `verifiedCount` | — | Removed (intentional) | None (derivable) | Compute from `is_verified` |
| `categoryBreakdown` | — | Removed (intentional) | None (derivable) | Compute on read |
| — | `status` | 🆕 Required, no source | — | Policy: `draft` |
| — | `aliases` `text[]` | 🆕 Present, unused | — | Available for registry migration |
| — | `notes` | 🆕 No source | — | — |

### 2.3 Beach

| Legacy | New | Status | Assessment |
|---|---|---|---|
| `beaches[]` (187) | `venues` where `category='Beach'` | Removed (intentional) | Design is sound — see `docs/DATABASE.md` §"Beaches: not a separate entity" |
| `name` | `venues.name` | Mappable | — |
| `area` | `venues.district` | Mappable | Semantically close |
| `destination` | `destination_id` | ⚠️ **3 of 187 unresolvable** — `Fouka`, `Ras El Hekma`, `Sidi Abdelrahman` are regional, not destination, names | — |
| `type` | `beach_details` JSONB | Column exists, **no writer** | §6.4 |
| `publicAccess` | `beach_details` JSONB | Column exists, **no writer** | §6.4 |
| — | `id`, `slug`, `lat`, `lng` | **Absent from source** | Cannot synthesize without inventing data |

**Assessment:** the *modelling* decision is correct; the *migration path* does
not exist. Beaches carry no ID, no slug, and no coordinates, so importing them
requires fabricating primary keys. Correctly deferred by current policy.

### 2.4 Category

| Legacy (11, curated) | New (9, CHECK-constrained) | Status |
|---|---|---|
| Restaurant (174) | `Restaurant` | ✅ Exact |
| Shopping (34) | `Shopping` | ✅ Exact |
| Hotel (28) | `Hotel` | ✅ Exact |
| Nightlife (9) | `Nightlife` | ✅ Exact |
| Other (2) | `Other` | ✅ Exact |
| Café (52) | `Cafe` | ⚠️ Accent only — needs sign-off |
| Service (20) | `Services` | ⚠️ Plural only — needs sign-off |
| **Activity (38)** | — | ❌ **No target** |
| **Spa (28)** | — | ❌ **No target** |
| **Beach Club (21)** | — | ❌ **No target** |
| **Resort (20)** | — | ❌ **No target** |
| — | `Beach`, `Entertainment` | 🆕 Unused by legacy data |

**107 / 426 venues (25.1%) cannot be assigned a legal category.**

### 2.5 Publishing

| Legacy capability | New equivalent | Status | Assessment |
|---|---|---|---|
| `POST /api/publish` (direct-to-live file write) | `POST /editor/publish` → immutable `publish_revisions` | ✅ **Superior** | Genuine architectural improvement |
| Immutable build history | `publish_revisions` + `is_current` partial unique index | ✅ Present | DB-enforced single source of truth |
| `POST /api/production/rollback` | `POST /editor/publish/revisions/{id}/republish` | ✅ API present | **No UI** — §5 |
| Build Comparison (diff two builds) | — | ❌ Missing | Medium — §5 |
| Pre-publish backup to timestamped dir | Superseded by immutable revisions | ✅ Replaced | — |
| Publish includes `beaches` | Snapshot = `destinations` + `venues` only | Consistent with beach folding | — |
| Publish fails if cover image missing | — | ❌ Missing | Low — integrity check lost |

### 2.6 Review workflow

| Legacy | New | Status |
|---|---|---|
| Review Queue | `status='review'` + `POST .../submit-for-review`, `.../approve` | ✅ **Superior** — real state machine + CHECK constraint |
| Bulk approve | `POST /editor/venues/bulk/approve` | ✅ Present |
| Validation gate | `POST /editor/venues/{id}/validate` + `bulk/validate` | ✅ Present |
| QA flags / Data Quality Center | — | Removed (intentional — `qa_flags`) |
| Field Locks | — | Removed (intentional) |
| Merge conflict resolution | — | Removed (intentional — `merge_history`) |
| Audit trail | `activity_log` table + Activity page | ✅ Present (re-implemented) |

### 2.7 Images

| Legacy | New | Status |
|---|---|---|
| Cover upload (`POST /api/media/cover`) | `POST /editor/venues/{id}/media` | ✅ Present |
| Gallery upload (`POST /api/media/gallery`) | Same endpoint, `slot='gallery'` | ✅ Present |
| Set cover from gallery | `POST /editor/venues/{id}/media/set-cover` | ✅ Present |
| Destination cover | `POST /editor/destinations/{id}/media` | ✅ Present |
| **Delete image** (`DELETE /covers/<path>`) | — | ❌ **Missing** |
| Media Manager UI | — | ❌ Missing |
| Cover sourcing status / priority / last-checked | — | Removed (intentional — `covers` tooling) |
| Storage | Local filesystem | Supabase Storage | ✅ Improved |

### 2.8 Social links

| Legacy | New | Status |
|---|---|---|
| `instagram`, `facebook`, `tiktok`, `phone`, `whatsapp`, `website`, `mapsUrl` | All present (`*_handle` naming) | ✅ Complete |
| `externalLink` | — | ❌ Missing (undocumented) |
| `sources`, `social`, `instagram` collections | — | Removed (intentional — tooling) |

### 2.9 Geo

| Legacy | New | Status | Assessment |
|---|---|---|---|
| `lat` / `lng` | `latitude` / `longitude` | ✅ Present | — |
| `destinations.boundary` polygon | `boundary` JSONB | ✅ Present | 10 of 25 populated |
| `geo.status` (inside/outside) | — | Removed (intentional) | Derivable from boundary + point |
| `geo.reviewed` / `reviewedAt` / `reviewedBy` | — | Removed (intentional) | **Human review effort lost** |
| `geo.distanceFromBoundaryKm` | — | Removed (intentional) | Computable |
| `geo.history[]` | — | Removed (intentional) | **Audit trail lost** |
| `geo.suggestion` | — | Removed (intentional) | — |
| Interactive boundary editor (v1.3.9) | — | ❌ Missing | Boundaries now read-only |
| Review Outliers | — | ❌ Missing | — |

Listed as `boundaryReviews` in "Explicitly excluded" — **intentional, not
forgotten.** But see §6.3: the *decision* was recorded, the *consequence* was
not designed for.

### 2.10 Statistics

| Legacy | New | Status |
|---|---|---|
| `stats.json` (9 aggregates, precomputed) | — | ❌ **No endpoint, no table, no UI** |
| Dashboard with live counts | `Dashboard.tsx` — 13-line hardcoded welcome | ❌ **Placeholder** |
| Destination Progress | — | ❌ Missing |
| Coverage metrics (`pctCover`, `pctInstagram`) | — | ❌ Missing |

All values are derivable from `venues`/`destinations` — this is a **missing
feature, not missing data**.

### 2.11 Users

| Legacy | New | Status |
|---|---|---|
| None (no auth — NAS-local tool) | Supabase Auth + `app_users` + 4 roles + `require_permission` | ✅ **Entirely new** |
| — | `GET /editor/users`, `PATCH .../role`, Users page | ✅ Present |

Unambiguous improvement. No legacy equivalent existed.

### 2.12 Settings

| Legacy | New | Status |
|---|---|---|
| Merge Profile, Field Locks, Scope, Workspace reset, storage config | `Settings.tsx` → `PagePlaceholder` | ❌ **Explicit placeholder** |

---

## 3. Feature comparison

| Feature | Legacy | New | Classification | Why missing |
|---|---|---|---|---|
| Review workflow | ✅ | ✅ Superior | — | — |
| Publishing | ✅ | ✅ Superior | — | — |
| Rollback / republish | ✅ UI | ⚠️ API only | **High** | UI never built |
| Publish trigger | ✅ UI | ⚠️ API only | **High** | UI never built |
| Bulk editing | ✅ | ✅ (5 bulk ops) | — | — |
| Search | ✅ | ✅ `q` ILIKE | — | — |
| Filters | ✅ | ✅ dest/category/status | — | — |
| Validation | ✅ | ✅ | — | — |
| Activity log | ✅ | ✅ | — | — |
| Image upload | ✅ | ✅ | — | — |
| **Image delete** | ✅ | ❌ | **Medium** | Overlooked |
| **Statistics / Dashboard** | ✅ | ❌ Placeholder | **High** | Deferred, never built |
| **Settings** | ✅ | ❌ Placeholder | **Medium** | Deferred, never built |
| **Export (CSV/JSON)** | ✅ | ❌ | **High** | Not considered |
| **Import** | ✅ | ❌ | **Critical (for migration)** | Not considered |
| **Geo review** | ✅ | ❌ | **Medium** | Intentional (tooling) |
| **Boundary editing** | ✅ | ❌ | **Medium** | Intentional (tooling) |
| **Beach management** | ✅ | ❌ | **High** | Folded into venues; no writer |
| **QA / Data Quality Center** | ✅ | ❌ | **Low** | Intentional (`qa_flags`) |
| **Duplicate detection** | ✅ | ❌ | **Medium** | Intentional (dedup cache) |
| **Merge engine / field locks** | ✅ | ❌ | **Low** | Intentional (`merge_history`) |
| **Destination registry / aliases UI** | ✅ | ⚠️ Column only | **Low** | `aliases` exists, no UI |
| **Build comparison** | ✅ | ❌ | **Medium** | Not considered |
| **Workspace backup/restore** | ✅ | ⚠️ Superseded | **Low** | Replaced by revisions + `pg_dump` |
| **District management** | ✅ | ⚠️ Free-text column | **Low** | Intentional |
| Authentication / RBAC | ❌ | ✅ | — | New capability |

---

## 4. Missing schema elements

**Blocking migration:**

1. **Category taxonomy** — no legal values for `Activity`, `Spa`,
   `Beach Club`, `Resort` (107 venues).
2. **`destinations.region`** — `NOT NULL`, absent from source for all 25.

**Non-blocking, undocumented:**

3. `venues.external_link` — 1 record.
4. `venues.rating`, `venues.reviews` — 0 populated.
5. `destinations.short_description` — 0 populated.

**Present but unreachable:**

6. `venues.beach_details` — no API or UI writes it.
7. `destinations.aliases` — no API or UI writes it.
8. `venues.opening_hours`, `internal_notes`, `source` — no writer.

**Intentionally excluded** (per `docs/DATABASE.md`): `geo`/`boundaryReviews`,
`qa_flags`, `merge_history`, `sources`, `registry`, `venue_map`,
`aliases.non_aliases`, `covers` metadata, and all derived counters.

---

## 5. Missing UI features

| # | Feature | Severity | Note |
|---|---|---|---|
| 1 | Publish button | **High** | `POST /editor/publish` exists but is unreachable from the Studio |
| 2 | Rollback / republish control | **High** | `POST .../republish` exists but is unreachable |
| 3 | Dashboard statistics | **High** | 13-line placeholder |
| 4 | Settings | **Medium** | Explicit `PagePlaceholder` |
| 5 | Export CSV / JSON | **High** | No way to get data out — a regression |
| 6 | Import | **Critical** | No venue-create endpoint at all |
| 7 | Image delete | **Medium** | Upload-only |
| 8 | Beach management | **High** | No way to set `beach_details` |
| 9 | Boundary editor | **Medium** | Boundaries importable but not editable |
| 10 | Duplicate detection | **Medium** | — |
| 11 | Build comparison | **Medium** | — |
| 12 | Pagination controls | **Low** | API paginates; UI requests one large page |

**Publishing is the sharpest finding.** The platform's entire architecture is
built around the draft → approve → publish model, `publish_revisions` is
implemented and correct, and the API exposes both publish and republish — but
**no human can trigger either from the Studio.** The Publishing page's own
comment says: *"No publish/rollback controls live here yet."* The system
cannot currently complete its own core workflow through its own UI.

---

## 6. Recommended schema additions

### 6.1 Category taxonomy — BLOCKING

`VENUE_CATEGORIES` was chosen from a brief and a review of *63 raw category
strings*, on the stated reasoning that the mess was *"almost entirely at the
subtype level."* DataLab has since curated those strings into a clean 11-value
taxonomy, and four values are **peer concepts, not subtypes**:

- `Resort` is not a subtype of `Hotel` (different product, pricing, stay model)
- `Beach Club` is not a subtype of `Beach` (commercial venue vs. geographic feature)
- `Spa` is not a subtype of `Services` (a spa is a destination, not a service desk)
- `Activity` is not a subtype of `Entertainment` (watersports ≠ nightlife/venues)

**Option A — extend the CHECK to 13 values (recommended).** Add `Resort`,
`Spa`, `Beach Club`, `Activity`. Zero data loss, one migration, still well
under the 15–20 threshold `docs/DATABASE.md` itself names as the trigger for
promoting `category` to a table. Preserves a distinction real editors made.

**Option B — force-map into the nine.** No schema change, but silently
collapses a curated distinction across 25% of the catalogue, irreversibly
(the source value is not retained anywhere).

**Option C — add `subcategory`.** Map to the nine, preserve the original in a
new nullable column. Compromise; adds a field with a single purpose.

**Recommendation: A.** The taxonomy was designed before the data was finished
being curated. The data is now the better evidence.

### 6.2 `destinations.region`
No schema change — 24 values must be supplied. Not inferable: only 6 of 25
slugs contain a recognisable area name, and the value *format* is unknown
(the single production example is `"Sidi Abdelrahman Area"`). Options: supply
manually (recommended), or relax to nullable — the latter contradicts the
documented "required, 5 known values" intent.

### 6.3 `venues.geo` — challenge the exclusion
The exclusion is **correctly reasoned for a product schema**: boundary-review
state is tooling, not a fact about a venue. The gap is that the *consequence*
was never designed: `datalab-next` is the ongoing curation tool, and it has no
geo-review capability at all. 426 venues carry `reviewed: true` with reviewer
and timestamp — real human work that will not survive migration.

**Recommendation:** uphold the exclusion for v1. Preserve the audit trail by
serialising `geo` into `venues.internal_notes` (or a new nullable
`legacy_geo` JSONB) **as an explicit, time-boxed decision**, so a future geo
feature can reconstruct history. Do not add a review workflow now.

### 6.4 `beach_details` — no writer
Add `beach_details` to the venue PATCH schema, or document it as reserved.
Today it is a column that nothing can populate — which will quietly become
"beaches were migrated but all beach facts are null."

### 6.5 Undocumented drops
Add `external_link`, `rating`, `reviews`, `destinations.short_description` to
the "Explicitly excluded" list, or add the columns. Currently they are
neither — which is how fields get silently lost twice.

---

## 7. Recommended API additions

| Priority | Addition | Rationale |
|---|---|---|
| **Critical** | `POST /editor/venues` (create) | **No venue-create endpoint exists.** Migration is impossible through the API; only a direct-model script can work |
| **High** | `GET /editor/stats` | Powers the Dashboard; all values derivable |
| **High** | `GET /editor/venues/export?format=csv\|json` | Restores a lost capability; no way to get data out today |
| **Medium** | `DELETE /editor/venues/{id}/media` | Upload-only is incomplete |
| **Medium** | `PATCH /editor/destinations/{id}` accepting `boundary` | Boundaries importable but not maintainable |
| **Medium** | `GET /editor/publish/revisions/{a}/diff/{b}` | Restores Build Comparison |
| **Low** | `POST /editor/venues/bulk/import` | Formalises repeatable ingest |
| **Low** | `GET /editor/venues/duplicates` | Restores duplicate detection |

---

## 8. Recommended migration changes

1. **Resolve the taxonomy first (§6.1).** Nothing else matters until 107
   venues have a legal category.
2. **Supply 24 `region` values.** Not inferable; do not guess.
3. **Preserve `geo` rather than dropping it silently (§6.3)** — a deliberate,
   recorded decision either way.
4. **Keep beaches deferred.** No IDs, no slugs, no coordinates; importing
   requires inventing primary keys. Revisit once `beach_details` has a writer
   and 3 unresolvable destination references are settled.
5. **Use a direct-model script, not the API** — no venue-create endpoint
   exists. Run in a single transaction, inside the API container, against
   the platform's own SQLAlchemy models so `CHECK` constraints apply. Take a
   database backup first.
6. **Do not downgrade the existing Marassi row.** Production has
   `region='Sidi Abdelrahman Area'`, `status='approved'`; the export has
   `region=null` and no status. Add the boundary polygon only.
7. **Remove the leftover test row** `test-dest-98e967ef` ("Should Not Be
   Public") before import, so post-migration counts are trustworthy.
8. **Expect `publish_revisions` to stay empty.** Importing as `draft`
   correctly means nothing becomes public — the site stays empty until
   content is approved and published, which currently **requires an API call
   with no UI** (§5).

---

## 9. Final verdict

> ### **(B) The new platform needs schema additions before migration.**

Not (A): the platform cannot represent 25% of the incoming catalogue, has two
placeholder pages, cannot export, and cannot trigger its own publish workflow
from its UI.

Not (C): the migration *strategy* is sound. Slug reconciliation, draft-only
import, and deferring beaches are all correct decisions that need no rethink.
The blockers are a small number of specific, fixable schema and data gaps —
not a flawed approach.

**Minimum to unblock migration:**

1. Extend `VENUE_CATEGORIES` by four values *(or accept documented lossy mapping)*
2. Supply 24 `destinations.region` values
3. Decide `venues.geo`: preserve or drop — recorded either way

**Should follow immediately after (not blocking, but the platform is
incomplete without them):**

4. Publish + rollback UI controls — the core workflow is currently unreachable
5. Dashboard statistics
6. Export

**A closing note on method.** Most gaps here are intentional and well
documented, and `docs/DATABASE.md` deserves credit for that — the
"Explicitly excluded from the schema" list answered most of this audit's
"why" questions directly. The two things that list did *not* protect against
are worth naming: fields dropped without ever being considered
(`externalLink`, `rating`, `reviews`), and decisions that were correct when
made but were never revisited as the source data evolved underneath them —
which is precisely what happened to the category taxonomy.
