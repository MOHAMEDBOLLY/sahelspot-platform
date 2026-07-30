# SahelSpot Platform Specification — v1.0 (FINAL)

**Status:** Frozen on approval. This document supersedes `docs/DATABASE.md`,
`docs/SCHEMA_GAP_AUDIT.md`, and `docs/FEATURE_PARITY_PLAN.md` as the
authoritative description of what the platform *is*. Those three remain as
historical record of how this specification was reached — they are not to be
read as current truth once this document is approved.

**This document describes the target architecture, not the current
implementation.** Every gap between this spec and the running system is
tracked as an implementation task, not a spec ambiguity.

**No code was written to produce this document. No schema, migration, or SQL
was written or executed.**

---

## 0. Contradictions resolved before writing this document

Two contradictions surfaced across the prior three documents. Both are
resolved here, final, not deferred:

1. **Beach data write path was placed in "Group 1 — must be completed before
   migration" in the roadmap, while the migration policy (approved
   separately) defers beaches entirely.** Resolution: **the roadmap's
   placement wins.** §6 makes beaches a venue subtype requiring
   `beach_details` to have a working write path *before* any beach record is
   imported. Deferring beaches was correct as a *migration-sequencing*
   decision under the old plan; it is superseded now that this spec exists —
   importing beaches with a permanently-null `beach_details` would violate
   §0.3 below (no field may exist with no writer).

2. **The category taxonomy's status — "enum, revisit at 15–20 values" — was a
   standing recommendation, not a decision.** §3 makes it a decision: **enum,
   13 values, and this section is the permanent record of why**, closing the
   taxonomy collision that blocked migration.

No other contradictions were found between the audit, the roadmap, and the
current schema.

---

## 1. Core Principles

These are load-bearing. Every entity and workflow decision below is a direct
application of one or more of these; where a decision seems to conflict with
a principle, the principle wins and the decision is wrong.

### 1.1 Product-first schema
The schema models **the North Coast destination/venue directory**, not any
tool that was ever used to assemble its data. A field earns a place here
because it is a fact about a destination, venue, or the editorial process —
never because a prior tool happened to track it.

### 1.2 No DataLab implementation leakage
Legacy DataLab's internal tooling — merge engines, field locks, QA dashboards,
dedup caches, competing registries — describes how data was *cleaned up*, not
what the product *is*. None of it enters this schema. See §11.

### 1.3 One canonical taxonomy
`venues.category` has exactly one authoritative value set, defined once in
§3, enforced by the database, never duplicated in a second list anywhere in
the codebase.

### 1.4 One source of truth per entity
Every fact lives in exactly one column of one table. Derived facts (counts,
percentages, breakdowns) are **computed on read**, never stored — storage
invites drift, and the legacy data already proved it (`destinations.venueCount`
disagreed with the real count for `seashell`: 13 claimed, 10 actual).

### 1.5 Explicit over implicit
Every state a row can be in is a named value in a column, not inferred from
the presence/absence of other data. Every decision this spec had to make in
place of a missing legacy rule (region, taxonomy, geo) is written down here,
not left to be inferred by whoever implements it next.

### 1.6 Forward-compatible
Nothing is designed to require a schema-breaking change for a currently-known
near-term need. Where a lightweight version of a future need exists cheaply
(e.g. a nullable column), it is included now; where it would require real
new infrastructure (a lookup table, a queue), it is deliberately deferred with
its trigger condition documented, not built speculatively.

### 1.7 Backward-compatible migration
The one, single, permitted migration (§10) must be able to run against this
spec without requiring a second migration event later for any entity in
scope. This is why beaches are in scope for v1 (§0.1) rather than deferred —
a deferred entity is a promise of a second migration event, which this
principle forbids.

### 1.8 No duplicated concepts
If two fields would ever answer the same question, one of them is deleted.
Example already avoided: `venues.destination` (display name) never entered
this schema — `venues.destination_id → destinations.name` already answers
that question once.

### 1.9 Frozen means frozen
Post-approval, this document changes only via the amendment procedure in §12.
An implementer who finds this spec insufficient stops and asks; they do not
improvise a deviation.

---

## 2. Entity Specifications

Field status legend: **Core** (defines the entity), **Optional** (nullable,
not every row needs it), **Internal** (editorial/system use, never public),
**Computed** (never stored, always derived at read time), **Legacy-only**
(exists solely to carry migrated data forward, not writable going forward).

### 2.1 Destination

| Field | Type | Required | Nullable | Default | Validation | Editable | API exposed | In publish snapshot | Status | Reason |
|---|---|---|---|---|---|---|---|---|---|---|
| `id` | text (PK) | Yes | No | — | Must equal `slug` (§7) | No (set at creation) | Yes | Yes | Core | Stable identifier; no surrogate needed |
| `name` | text | Yes | No | — | 1–200 chars | Yes | Yes | Yes | Core | Display name |
| `region` | text | Yes | No | — | 1–200 chars, non-blank | Yes | Yes | Yes | Core | Broad corridor grouping (§7.2) |
| `status` | text | Yes | No | `draft` | `draft \| review \| approved \| archived` | Via workflow only (§4) | Yes | Implicit (only `approved` rows are ever snapshotted) | Core | Editorial state |
| `aliases` | text[] | No | Yes | `null` | — | Yes | Yes | Yes | Optional | Alternate names for search/matching |
| `boundary` | JSONB (GeoJSON) | No | Yes | `null` | Valid GeoJSON `Polygon`/`MultiPolygon` when present | Yes (§7.3 — API must accept writes) | Yes | Yes | Optional | Map geofence |
| `notes` | text | No | Yes | `null` | ≤2000 chars | Yes | Yes | No (editorial only) | Internal | Editor working notes |
| `cover_image_url` | text | No | Yes | `null` | Valid URL | Yes (via media upload) | Yes | No — cover is not currently part of the public snapshot; **carried in the record for forward-compatibility, not yet read publicly** | Optional | Destination hero image |
| `last_published_at` | timestamptz | No | Yes | `null` | Set only by publish engine | No | Yes | No | Internal | Audit of last inclusion in a snapshot |
| `created_at` / `updated_at` | timestamptz | Yes | No | `now()` | Managed | No | Yes | No | Internal | Standard audit columns |
| `venue_count`, `verified_count`, `category_breakdown` | — | — | — | — | — | — | **Computed** (§8, `GET /editor/destinations/{id}/stats`) | No | Computed | Never stored — §1.4 |
| `short_description` | — | — | — | — | — | — | **Not in v1** | — | Legacy-only, rejected | 0 populated in the entire legacy dataset; no product requirement recorded. Add only if a real content need appears (§12 amendment) |

### 2.2 Venue

| Field | Type | Required | Nullable | Default | Validation | Editable | API exposed | In publish snapshot | Status | Reason |
|---|---|---|---|---|---|---|---|---|---|---|
| `id` | text (PK) | Yes | No | — | — | No | Yes | Yes | Core | Stable identifier |
| `name` | text | Yes | No | — | 1–200 chars | Yes | Yes | Yes | Core | Display name |
| `slug` | text | Yes | No | — | Unique per destination | No (set at creation) | Yes | Yes | Core | URL-safe identifier |
| `destination_id` | text (FK) | Yes | No | — | Must reference an existing destination | Yes (bulk move supported) | Yes | Yes (as `destination_id`) | Core | Parent destination |
| `district` | text | No | Yes | `null` | — | Yes | Yes | Yes | Optional | Sub-area within a destination |
| `category` | text | Yes | No | — | One of 13 values (§3) | Yes | Yes | Yes | Core | Taxonomy — see §3 |
| `status` | text | Yes | No | `draft` | `draft \| review \| approved \| archived` | Via workflow only (§4) | Yes | Implicit | Core | Editorial state |
| `is_featured` | bool | Yes | No | `false` | — | Yes | Yes | Yes | Optional | Curatorial highlight flag |
| `is_verified` | bool | Yes | No | `false` | — | Yes | Yes | Yes | Optional | Editorial verification flag |
| `latitude` / `longitude` | Numeric(9,6) | No | Yes | `null` | Real-world coordinate range | Yes | Yes | Yes | Core | Location |
| `phone`, `whatsapp`, `website`, `maps_url` | text | No | Yes | `null` | — | Yes | Yes | Yes | Optional | Contact channels |
| `instagram_handle`, `facebook_handle`, `tiktok_handle` | text | No | Yes | `null` | — | Yes | Yes | Yes | Optional | Social channels |
| `short_description` | text | No | Yes | `null` | ≤500 chars | Yes | Yes | Yes | Optional | Public-facing summary |
| `cover_image_url` | text | No | Yes | `null` | Valid URL | Yes (via media upload) | Yes | Yes | Optional | Primary image |
| `gallery_image_urls` | text[] | No | Yes | `null` | Ordered list of valid URLs | Yes (via media upload) | Yes | Yes | Optional | Additional images |
| `opening_hours` | JSONB | No | Yes | `null` | Day-keyed open/close pairs | Yes | Yes | Yes | Optional | No source data has this populated today; retained as forward-compatible (§1.6) |
| `beach_details` | JSONB | No | Yes | `null` | `{type: string\|null, publicAccess: "yes"\|"no"\|"unknown"}` when `category = 'Beach'`; `null` otherwise | **Yes — writer required for v1 (§6)** | Yes | Yes | Core (for beach venues) | Beach-specific facts (§6) |
| `internal_notes` | text | No | Yes | `null` | ≤2000 chars | Yes | Yes | No | Internal | Editor working notes |
| `source` | text | No | Yes | `null` | — | Yes | Yes | No | Internal | Data provenance (recommended: populate on import, see §10) |
| `legacy_geo` | JSONB | No | Yes | `null` | Opaque — not validated or interpreted by the platform | No | No — internal only | No | Legacy-only | Preserves the legacy geo-review object (status, reviewer, timestamp, history) verbatim. No workflow is built on it (§11). Write-once at import; not part of any editing surface |
| `last_published_at`, `created_at`, `updated_at` | timestamptz | Yes | No | `now()` | Managed | No | Yes | No | Internal | Standard audit columns |
| `rating`, `reviews` | — | — | — | — | — | — | **Not in v1** | — | Legacy-only, rejected | 0 populated across the entire legacy dataset. No rating source exists in this platform. Add only when a real rating feature (e.g. a moderation-backed review system) is scoped |
| `external_link` | — | — | — | — | — | — | **Not in v1, folded into `website`** | — | Legacy-only, rejected | 1 populated legacy record; no recorded semantic distinction from `website`. Migrated value goes into `website` if `website` is empty for that row, otherwise into `internal_notes` (§10.2), never dropped silently |

### 2.3 Beach

**There is no `beaches` table and none will be created.** A beach is a venue
with `category = 'Beach'` and a populated `beach_details` JSONB. See §6 for
the full reasoning. This section exists only to map legacy beach fields onto
the venue model:

| Legacy field | Venue field | Notes |
|---|---|---|
| `name` | `name` | — |
| `area` | `district` | Closest semantic match |
| `destination` | `destination_id` | 3 of 187 legacy values (`Fouka`, `Ras El Hekma`, `Sidi Abdelrahman`) are regional names with no matching destination — resolved per §10.4, not invented here |
| `type` | `beach_details.type` | — |
| `publicAccess` | `beach_details.publicAccess` | — |
| — | `category` | Always `"Beach"` for a migrated beach record |
| — | `id`, `slug`, `latitude`, `longitude` | **Not present in the legacy export.** Must be assigned per §10.4 (deterministic derivation, never invented per-field data) |

### 2.4 Category

Not a table. See §3 in full.

### 2.5 Publish Revision

| Field | Type | Required | Nullable | Default | Editable | API exposed | Reason |
|---|---|---|---|---|---|---|---|
| `id` | bigint (PK, identity) | Yes | No | auto | No | Yes | Immutable revision identifier |
| `snapshot` | JSONB | Yes | No | — | **Never** (write-once at creation, enforced) | Yes (detail view only) | The frozen `{destinations: [...], venues: [...]}` payload — see §5 |
| `is_current` | bool | Yes | No | `false` | System only, via publish/republish | Yes | Exactly one row may be `true` — DB-enforced (partial unique index) |
| `published_at` | timestamptz | Yes | No | `now()` | No | Yes | — |
| `published_by` | text | No | Yes | `null` | No | Yes | Actor who triggered the publish |
| `label` | text | No | Yes | `null` | Yes, post-hoc | Yes | Human-friendly annotation ("Pre-launch content freeze") |
| `destination_count`, `venue_count` | int | No | Yes | — | No | Yes | Denormalized for the revision list UI — **exception to §1.4**: justified because it describes a *frozen, immutable* snapshot, not a live, changing count; there is no drift risk once written |

### 2.6 User (`app_users`)

| Field | Type | Required | Nullable | Default | Editable | API exposed | Reason |
|---|---|---|---|---|---|---|---|
| `id` | text (PK) | Yes | No | — | No | Yes | Supabase Auth user id — identity lives outside this database |
| `email` | text | No | Yes | `null` | No | Yes | Denormalized display only; Supabase remains the source of truth |
| `role` | text | Yes | No | `viewer` (via bootstrap) | Yes, via `PATCH /editor/users/{id}/role` | Yes | `viewer \| editor \| publisher \| admin` |
| `created_at`, `updated_at` | timestamptz | Yes | No | `now()` | No | Yes | Standard audit columns |

### 2.7 Media

**Not a table.** Media is two columns on `Destination`/`Venue`
(`cover_image_url`, and `gallery_image_urls` for venues only), backed by
Supabase Storage. Per §1.8, this is a deliberate non-entity:

| Concern | v1 model |
|---|---|
| Storage | Supabase Storage, service-role uploads only |
| Ordering | `gallery_image_urls` array order *is* display order |
| Captions / alt text | **Not in v1.** Promote to a real `venue_images` table only if this becomes a real requirement — no source data has ever carried it |
| Deletion | **Required for v1** — see §8, currently missing from the API |

### 2.8 Review (workflow, not an entity)

Review is a **state**, not a row. See §4. There is no `reviews` table; a
venue or destination *is* "in review" by virtue of `status = 'review'`.

### 2.9 Statistics

**Not stored. Always computed.** Per §1.4, no `stats` table or JSON blob
exists. All values are derived at request time from `destinations` and
`venues`:

| Legacy `stats.json` field | v1 computation |
|---|---|
| `venues` | `COUNT(*) FROM venues` |
| `destinations` | `COUNT(*) FROM destinations` |
| `categories` | `COUNT(DISTINCT category)` (bounded by §3's 13) |
| `withCover` | `COUNT(*) WHERE cover_image_url IS NOT NULL` |
| `withInstagram` | `COUNT(*) WHERE instagram_handle IS NOT NULL` |
| `withWebsite` | `COUNT(*) WHERE website IS NOT NULL` |
| `withPhone` | `COUNT(*) WHERE phone IS NOT NULL` |
| `pctCover`, `pctInstagram` | Computed ratios, not stored |

Exposed via `GET /editor/stats` (§8). No new table, no new column.

---

## 3. Taxonomy Specification — FINAL

### 3.1 The decision

**`venues.category` remains a `CHECK`-constrained plain-text column — not a
table — with exactly 13 legal values:**

```
Restaurant · Cafe · Hotel · Beach · Nightlife · Shopping · Services ·
Entertainment · Other · Resort · Spa · Beach Club · Activity
```

This permanently resolves the collision identified in the audit (107 of 426
legacy venues, 25.1%, had no legal value under the prior 9-value list).

### 3.2 Why every one of the 13 exists

| Category | Why it exists |
|---|---|
| `Restaurant` | Largest single category in real data (174 legacy venues) — core product content |
| `Cafe` | Distinct from `Restaurant` in customer intent and legacy data (52 venues, as `Café`) |
| `Hotel` | Core accommodation type |
| `Beach` | The product's namesake content type; also the venue-subtype home for all beach records (§6) |
| `Nightlife` | Distinct evening-economy category (9 venues) |
| `Shopping` | Distinct retail category (34 venues) |
| `Services` | Non-hospitality services (20 legacy venues, as `Service`) |
| `Entertainment` | Distinct from `Nightlife` — attractions rather than bars/clubs |
| `Other` | Deliberate safety valve — a handful of venues never cleanly fit any bucket (2 in legacy data); removing it would force a false categorization |
| `Resort` | **Added by this spec.** Not a subtype of `Hotel` — different product, pricing, and stay model. 20 legacy venues |
| `Spa` | **Added by this spec.** Not a subtype of `Services` — a spa is a destination in its own right, not a service desk. 28 legacy venues |
| `Beach Club` | **Added by this spec.** Not a subtype of `Beach` — a commercial venue (entry fee, food/drink, loungers) versus a geographic feature. 21 legacy venues |
| `Activity` | **Added by this spec.** Not a subtype of `Entertainment` — watersports/tours/experiences are a distinct commercial category from nightlife/attractions. 38 legacy venues |

### 3.3 Why no other category exists

The legacy data's raw, uncurated form had **63 distinct strings**
(`"seafood restaurant"`, `"italian restaurant"`, `"syrian restaurant"`, etc.).
Those are **subtypes**, not categories — a future `cuisine` or `subtype`
nullable text column (§1.6, forward-compatible, not built now) is the correct
home for that granularity, not an expansion of this list. The 13 values above
are the complete, closed set of **top-level** groupings; anything finer is
explicitly out of scope for `category` itself.

### 3.4 Enum vs. table — the permanent decision

**Remains an enum (`CHECK` constraint), not a table.**

| Consideration | Enum (chosen) | Table (rejected) |
|---|---|---|
| Value count | 13 — small, closed | Only justified once metadata (icon, sort order, localized name) is needed |
| Change frequency | Product-defined, rarely changing | A table earns its cost when values change often |
| Query cost | Zero joins for the most common filter in the product | Every venue list/filter pays a join |
| Documented threshold | **This spec permanently fixes the threshold: promote to a table only if the value count exceeds 20, or if per-category metadata (icon, display order, i18n) becomes a real requirement.** | — |

This is not a re-opening of the question — it is the closing of it. The prior
documents left this as "revisit later"; this spec removes the ambiguity by
naming the exact trigger condition. Below that trigger, changing this to a
table is a spec violation requiring the §12 amendment procedure.

### 3.5 Rename policy

`Café` → `Cafe` and `Service` → `Services` are **confirmed, final** mappings
(accent and pluralization normalization only, no semantic change). This
closes the two "near-certain but needs sign-off" items from the audit.

---

## 4. Workflow Specification

### 4.1 State machine (identical for `destinations` and `venues` — one shared vocabulary, per §1.3's sibling principle: one workflow, not two that happen to match)

```
draft ──Submit for Review──► review ──Approve──► approved ──Publish──► (frozen in a revision)
  ▲                             │                    │
  └─────────Reject──────────────┘                    │
                                                        └──Archive──► archived
```

### 4.2 Allowed transitions

| From | To | Trigger | Who | Validation gate |
|---|---|---|---|---|
| `draft` | `review` | Submit for Review | `editor`, `publisher`, `admin` | **Validate must pass** (§4.4) — required fields present, valid category, coordinates in range |
| `review` | `approved` | Approve | `publisher`, `admin` | Same validation re-checked at approval time (state may have changed since submission) |
| `review` | `draft` | Reject | `publisher`, `admin` | None — always allowed |
| `approved` | *(included in next Publish)* | Publish (§5) | `publisher`, `admin` | Row is simply gathered; no additional gate |
| any | `archived` | Archive | `admin` | None |
| `archived` | `draft` | Restore | `admin` | None |

No other transition is legal. `draft → approved` directly is **not** allowed
— every row must pass through `review`.

### 4.3 Permissions

Reuses the existing 4-role model (`viewer < editor < publisher < admin`),
unchanged by this spec:

| Role | Can view | Can edit (`draft`) | Can submit for review | Can approve/reject | Can publish/rollback | Can manage users |
|---|---|---|---|---|---|---|
| `viewer` | Yes | No | No | No | No | No |
| `editor` | Yes | Yes | Yes | No | No | No |
| `publisher` | Yes | Yes | Yes | Yes | Yes | No |
| `admin` | Yes | Yes | Yes | Yes | Yes | Yes |

### 4.4 Validation rules (the "Validate" gate)

Applies identically to bulk and single-row submission:

| Rule | Applies to | Failure |
|---|---|---|
| `name` non-blank | Both | Error |
| `category` is one of the 13 values (§3) | Venue | Error |
| Coordinates within real-world range, if present | Venue | Error |
| `region` non-blank | Destination | Error |
| `beach_details` shape valid when `category = 'Beach'` | Venue | Error (§6.3) |

Validation produces **errors only** in v1 (no warnings that block readiness —
this matches the current implementation and is intentionally retained, not
expanded).

### 4.5 Rollback behaviour

Rollback is **republish**, not row-level undo: it points `is_current` at a
prior, already-immutable revision. It never mutates `destinations` or
`venues` rows, and it never resurrects a deleted or archived row's live
editorial state — only what the public sees. See §5.3.

---

## 5. Publishing Specification

### 5.1 Publish Revision

A `publish_revisions` row is an **immutable, whole-dataset snapshot**,
created by gathering every currently `approved` destination and venue into
one JSONB payload. See §2.5 for the schema. The database itself guarantees
exactly one `is_current = true` row via a partial unique index — this is not
an application-level convention, it is enforced structurally (§1.5).

### 5.2 Snapshots

- Snapshot shape: `{"destinations": [...], "venues": [...]}`, each row
  serialized per the field lists in §2.1/§2.2's "In publish snapshot" column.
- `status` is never included — every row in a snapshot is implicitly
  `approved` by construction.
- Editorial-only fields (`internal_notes`, `source`, `legacy_geo`, timestamps)
  are never included.
- Snapshots are never updated after insert. This must be enforced at the
  database level (a trigger or equivalent), not merely assumed by
  application discipline — carried forward from the original schema design
  recommendation, now made a hard requirement of this spec.

### 5.3 Rollback

`POST /editor/publish/revisions/{id}/republish`: flips `is_current` to the
target (already-existing, already-immutable) revision, in the same
transaction as un-flipping the previous current one. **Required for v1** via
UI (§8, §9) — the API already exists; the absence of a UI control is a
parity gap this spec closes, not a design decision.

### 5.4 Rebuild

There is no separate "rebuild" concept in v1. A rebuild is simply a new
Publish — the snapshot is always regenerated from live `approved` rows, never
patched or incrementally updated. This is deliberately simpler than legacy
DataLab's separate immutable-build system with hardlinked cover images; that
complexity existed to manage a filesystem-based static site, which this
platform's database-backed publish model does not need.

### 5.5 Diff

**Required for v1's operational completeness, not for launch.** A revision
diff (`GET /editor/publish/revisions/{a}/diff/{b}`) computes the difference
between two snapshots' `destinations`/`venues` arrays at request time — never
stored. Classified as Milestone 5 operational tooling (§9), not a launch
blocker.

### 5.6 Validation (pre-publish)

Publish itself performs **no additional validation** — every row it gathers
already passed the Approve gate (§4.4). This is a deliberate design
invariant: Publish's only job is freezing what Approval already certified.

### 5.7 Failure recovery

| Failure mode | Recovery |
|---|---|
| Concurrent publish attempted | Rejected with `409 concurrent_publish` — the existing behavior, retained |
| Publish transaction fails mid-write | Whole transaction rolls back; the previous `is_current` revision remains current — no partial state is possible because the flip and the insert are one transaction |
| A bad revision was published | Republish (§5.3) to the last-known-good revision — never a manual data fix |
| Snapshot data itself was wrong (bad source rows) | Fix the live rows, re-approve, re-publish — a new revision, never an edit to a frozen one |

---

## 6. Beach Model — FINAL DECISION

### 6.1 The decision

**Mixed model: venue subtype, not a separate entity.** A beach is a row in
`venues` with `category = 'Beach'` and a populated `beach_details` JSONB
column. There is no `beaches` table, now or planned.

### 6.2 Why

| Option | Verdict | Reasoning |
|---|---|---|
| Separate entity (`beaches` table) | **Rejected** | Roughly a quarter of legacy beach records share an exact name with an existing venue record — beaches and venues are not disjoint populations. A separate table would need a nullable cross-reference to reconcile the overlap, reintroducing exactly the "maybe this beach is also a venue" ambiguity the unified model exists to remove |
| Venue subtype (chosen) | **Chosen** | One table to query/filter/reason about. "Show me everything in Hacienda Bay" doesn't need to special-case beaches. Category filtering ("show me beaches in this destination") works identically to every other category filter |
| Pure JSON extension (no `category='Beach'` marker) | **Rejected** | Would make "is this a beach" ambiguous/derived rather than a first-class, indexable fact — violates §1.5 (explicit over implicit) |
| Fully mixed — beach-only facts on every venue row | **Rejected** | `beach_details` is `null` for the ~75% of venues that aren't beaches — no bloat, per the existing JSONB pattern already used for `boundary` |

### 6.3 What closes the audit's finding

The audit found the *modelling* decision correct but the *implementation*
incomplete: **`beach_details` has no writer.** This spec makes closing that
writer a **v1 requirement, not an optional enhancement**:

- `PATCH /editor/venues/{id}` **must** accept `beach_details` when
  `category = 'Beach'`.
- The venue edit UI **must** expose `type` and `publicAccess` fields when the
  selected category is `Beach`.
- Validation (§4.4) **must** reject a malformed `beach_details` shape.

Without this, migrating beaches (§10) would produce rows with permanently
null beach-specific facts — a silent, structural data loss this spec does not
permit (§0.1).

### 6.4 Identity for migrated beach records

Legacy beach records have no `id`, `slug`, or coordinates. This spec mandates
a **deterministic, documented derivation** at migration time (§10.4) — never
per-record invention. The exact derivation rule is specified in §10, not
here, because it is a migration-time procedure, not a schema property.

---

## 7. Destination Model

### 7.1 Slug
`id = slug`. No surrogate key. Chosen because destinations are a small
(25-today), stable, human-curated set where the slug **is** the natural,
permanent identifier — the same reasoning that already justified
`venues.id` as a plain stable string rather than a UUID.

### 7.2 Region
Plain required text column, not a table. ~5–8 known values today
(`"Sidi Abdelrahman Area"` is the one production example). Too small and
static to justify a lookup table — same threshold logic as §3.4, and subject
to the same rule: promote to a table only past a real growth/metadata
trigger, not preemptively.

### 7.3 Boundary
JSONB GeoJSON polygon, nullable. **This spec requires `PATCH
/editor/destinations/{id}` to accept `boundary` writes** — currently
importable but not maintainable, a gap this spec closes as an API
requirement (§8), not a schema change (the column already exists correctly).

### 7.4 Status
Same shared vocabulary as venues (§4): `draft | review | approved | archived`.
A destination must be `approved` to be included in a publish snapshot,
identical rule to venues.

### 7.5 Display name
`name` is the single display name. No secondary "display override" field —
per §1.8, one field answers one question.

### 7.6 Sorting
Publish snapshot orders destinations by `name` (existing behavior, retained).
No separate `sort_order` column — alphabetical is sufficient for a 25-item,
human-scannable list; revisit only if the destination count grows by an order
of magnitude.

### 7.7 Validation
Per §4.4: `name` and `region` non-blank, 1–200 chars.

### 7.8 Future extensibility
`aliases` (text[]) already exists and is forward-compatible with a future
alias-matching feature (§9's "Alias management UI", Group 3 — not v1). No
schema change needed when that UI is eventually built.

---

## 8. API Specification

Grouped as requested. **Required** = must exist for this spec to be
considered implemented. **Optional** = nice to have, not blocking. **Future**
= explicitly deferred, tracked but not scheduled.

### 8.1 Destinations
| Endpoint | Status |
|---|---|
| `GET /editor/destinations` | Required (exists) |
| `POST /editor/destinations` | Required (exists) |
| `GET /editor/destinations/{id}` | Required (exists) |
| `PATCH /editor/destinations/{id}` | Required (exists) — **must be extended to accept `boundary`** (§7.3) |
| `DELETE /editor/destinations/{id}` | Required (exists) |
| `POST /editor/destinations/{id}/media` | Required (exists) |
| `GET /editor/destinations/{id}/stats` | Required, **new** — powers computed stats (§2.9) |
| `POST /editor/destinations/{id}/submit-for-review`, `/approve` | Required, **new** — parity with venue workflow (§4) |

### 8.2 Venues
| Endpoint | Status |
|---|---|
| `GET /editor/venues` | Required (exists) |
| `POST /editor/venues` | Required, **new** — no venue-create endpoint exists today; blocks both migration and ordinary editorial growth |
| `GET /editor/venues/{id}` | Required (exists) |
| `PATCH /editor/venues/{id}` | Required (exists) — **must accept `beach_details`** (§6.3) |
| `POST /editor/venues/{id}/media`, `/media/set-cover` | Required (exists) |
| `DELETE /editor/venues/{id}/media` | Required, **new** — upload-only today |
| `POST /editor/venues/{id}/validate` | Required (exists) |
| `POST /editor/venues/{id}/submit-for-review`, `/approve` | Required (exists) |
| `POST /editor/venues/bulk/validate`, `/bulk/submit-for-review`, `/bulk/approve` | Required (exists) |
| `PATCH /editor/venues/bulk/category`, `/bulk/destination` | Required (exists) |
| `GET /editor/venues/duplicates` | Optional, future (§9 Group 3) |

### 8.3 Publishing
| Endpoint | Status |
|---|---|
| `POST /editor/publish` | Required (exists) |
| `GET /editor/publish/revisions` | Required (exists) |
| `GET /editor/publish/revisions/{id}` | Required (exists) |
| `POST /editor/publish/revisions/{id}/republish` | Required (exists) |
| `GET /editor/publish/revisions/{a}/diff/{b}` | Optional, future (§5.5) |

### 8.4 Media
| Endpoint | Status |
|---|---|
| `POST /editor/venues/{id}/media` (cover, gallery) | Required (exists) |
| `POST /editor/venues/{id}/media/set-cover` | Required (exists) |
| `DELETE /editor/venues/{id}/media` | Required, **new** |
| `POST /editor/destinations/{id}/media` | Required (exists) |

### 8.5 Users
| Endpoint | Status |
|---|---|
| `GET /editor/me` | Required (exists) |
| `GET /editor/users` | Required (exists) |
| `PATCH /editor/users/{id}/role` | Required (exists) |

### 8.6 Import
| Endpoint | Status |
|---|---|
| One-time migration script (not an endpoint) | Required — §10. Uses platform models directly, not raw SQL, not a permanent API surface |
| `POST /editor/venues/bulk/import` (repeatable, ongoing) | Optional, future — formalizes ingest beyond the one-time migration |

### 8.7 Export
| Endpoint | Status |
|---|---|
| `GET /editor/venues/export?format=csv\|json` | Required — restores a legacy capability with no current equivalent; write-only data is a regression |
| `GET /editor/destinations/export` | Required, same rationale |

### 8.8 Health
| Endpoint | Status |
|---|---|
| `GET /` | Required (exists) |
| `GET /health` | Required (exists) |

### 8.9 Admin
| Endpoint | Status |
|---|---|
| `GET /editor/stats` | Required, **new** — §2.9 |
| `GET /editor/activity` | Required (exists) |

---

## 9. DataLab Specification (the Studio)

### 9.1 Required for v1 (must exist before this spec is considered implemented)
- Venue list, detail, edit (exists)
- Destination list, detail, edit (exists)
- Review workflow controls: submit, approve, reject (exists)
- Bulk operations: validate, submit, approve, category/destination move (exists)
- Activity log (exists)
- User role management (exists)
- **Publish control** — currently missing; the API exists, the button does not
- **Rollback/republish control** — same gap
- **Beach fields in the venue editor** (`type`, `publicAccess`) — required by §6.3
- **Boundary write support** in the destination editor, or at minimum an API
  path (§7.3) even if the UI ships later

### 9.2 Required for production (must exist before public launch, not before this spec is "done")
- Dashboard with real statistics (§2.9) — currently a hardcoded placeholder
- Export UI
- Image delete control
- Venue create form (pairs with §8.2's new endpoint)

### 9.3 Future
- Settings page (scope not yet defined — an empty settings page is worse than
  today's honest placeholder; do not build until there is something to
  configure)
- Revision diff / build comparison UI
- Duplicate detection UI
- Alias management UI
- Pagination controls (API already supports it)
- District management view
- Map-based boundary editor

### 9.4 Explicitly rejected
See §11 — merge engine, field locks, QA/Data Quality Center, workspace
backup/restore, registry, geo review workflow (data preserved per §2.2's
`legacy_geo`, workflow not rebuilt).

---

## 10. Migration Specification

**This section describes procedure only. No implementation, no code, no SQL.**
It may proceed only after §12's freeze is approved and every item in §9.1 and
the schema changes in §2–§7 are actually built — this specification being
written does not itself unblock migration.

### 10.1 Legacy mapping
Full field-by-field mapping is §2's tables (the "Reason" and per-field notes
columns double as the mapping record). Summary of the non-trivial mappings:

- Destinations: reconcile by **slug** (`export.slug` → `id`). Existing
  production rows are **updated in place**, never duplicated. Legacy
  `dest00009`-style ids are discarded entirely.
- Venues: `destSlug` → `destination_id` (verified 100% resolvable in the
  audited export). `category` mapped 1:1 against the now-13-value taxonomy
  (§3) — zero venues blocked, this being the entire point of §3.
- Beaches: mapped onto `venues` per §2.3/§6.4.

### 10.2 Field-loss handling
- `external_link` (1 record): merged into `website` if empty, else appended
  to `internal_notes` prefixed `[legacy external link]` — never silently
  dropped.
- `venues.geo` (426 records): copied verbatim into `legacy_geo` (§2.2).
- `rating`, `reviews`, destination `short_description`: confirmed 0
  populated in the source at audit time; no migration action needed, but the
  migration report (§10.6) must state the checked count, not assume it.

### 10.3 Validation (pre-write)
Every row must pass §4.4's validation rules *before* insertion — the
migration uses the platform's own validation function, not a parallel
reimplementation, so imported and hand-created rows are held to identically
enforced rules.

### 10.4 Import strategy
- Single transaction, single script, run once, using the platform's
  SQLAlchemy models directly (not raw SQL, not the HTTP API — consistent
  with the "no raw SQL unless required" and "no manual DB edits" rules
  already established for this project).
- All imported rows land as `status = 'draft'`. Nothing is auto-approved,
  nothing is published as a side effect of import.
- Beach identity derivation (§6.4): `id` and `slug` generated deterministically
  from `(destination_id, name)` via a documented, reproducible slugification
  rule — written down in the migration runbook before the script runs, not
  invented ad hoc during it. The 3 beaches with unresolvable destination
  names (`Fouka`, `Ras El Hekma`, `Sidi Abdelrahman`) are held out and
  reported, not force-assigned to a guessed destination.
- Coordinates for beaches: **absent in the legacy source.** Imported as
  `NULL`, never fabricated (§0's "no field may exist with no writer" applies
  to the *column*, not to *inventing values the source never had* — a null
  coordinate is honest; a guessed one is not).

### 10.5 Rollback
Standard database backup taken immediately before the migration transaction
runs (`api/scripts/backup_db.sh`). Rollback is: restore that backup. The
migration is not attempted as a series of smaller commits that could be
partially rolled back — it is one transaction, succeed or fail atomically.

### 10.6 Verification
Post-import validation report, mechanically generated, must include:
- Row counts: destinations updated, destinations created, venues imported,
  beaches imported, records excluded (with reason for each).
- Zero broken foreign keys (every `destination_id` resolves).
- Zero duplicate `(destination_id, slug)` pairs.
- Zero duplicate venue/destination ids.
- Confirmation the existing production Marassi destination retained its
  original `region` and `status`, gaining only the boundary polygon (per the
  approved policy: never silently overwrite production data).
- Confirmation `publish_revisions` is unchanged (still reflects only
  pre-migration approved content, if any) — migration never publishes.

### 10.7 Dry run
Required before the real migration: run the identical script against a
disposable copy of the production schema (not production data), using the
same export file, and produce the same verification report. The dry run's
report is compared line-for-line against the real run's — any divergence
beyond row-count-appropriate differences is a stop condition.

### 10.8 Acceptance criteria
Migration is accepted only if **all** of the following hold:
1. §10.6's verification report shows zero unexplained discrepancies.
2. Every venue has a legal `category` (§3) — zero exceptions, this being the
   condition §3 exists to guarantee.
3. Every destination has a non-null `region`.
4. The leftover test destination (`test-dest-98e967ef`, "Should Not Be
   Public") is confirmed absent from production before the migration begins.
5. Nothing is published as a result of migration — `publish_revisions`'
   `is_current` row, if any existed before, is unchanged.

---

## 11. Out of Scope

Explicitly, permanently excluded. Belongs to DataLab engineering history, not
the production platform (§1.2). Re-raising any of these requires the §12
amendment procedure and a new, affirmative product reason — not "the old tool
had it."

| Excluded | Why |
|---|---|
| **Merge engine** (conflict diff, field locks, "keep/use incoming") | Existed to reconcile competing import sources feeding one dataset. The platform has exactly one source of truth (§1.4) — the problem this solved no longer exists |
| **Registry / destination alias-matching tooling** | Import bookkeeping for the merge engine above |
| **QA flags / Data Quality Center dashboard** | Superseded by the enforced validation gate (§4.4) — advisory flags are replaced by a hard gate |
| **Geo review workflow** (boundary-inside/outside review, reviewer assignment, review history UI) | Data is preserved verbatim (`legacy_geo`, §2.2); the *workflow* is not rebuilt — boundary-review state is tooling, not a product fact |
| **Interactive boundary review/outlier UI** | Same as above |
| **Workspace save/restore/backup system** | Superseded structurally by `publish_revisions` (immutable, DB-enforced) and standard `pg_dump` |
| **`sources`, `venue_map`, dedup caches** | Import bookkeeping with no product meaning |
| **`aliases.non_aliases`** | Artefact of the merge engine's matching logic specifically |
| **Cover image sourcing status / priority / "last checked"** | Production-workflow tracking about *how an image was obtained*, not a fact about the venue |
| **NAS file-manager integration** (`POST /api/folder/open`) | Artefact of a locally-hosted tool; meaningless under this deployment model |
| **Build Comparison as a first-class immutable-build system** | Superseded by revision diff (§5.5, itself Optional/future) — the underlying need (compare two points in time) is retained; the legacy *mechanism* (hardlinked filesystem builds) is not |
| **Any derived/cached count** (`venueCount`, `verifiedCount`, `categoryBreakdown`, `stats.json`) | Computed on read (§2.9) — storing them is exactly the class of bug already observed in the legacy data |

---

## 12. Version Freeze

# PLATFORM SPECIFICATION v1.0

Upon approval of this document:

- **No schema changes** outside what §2–§7 already specify.
- **No taxonomy changes** — §3's 13 values and the enum-not-table decision
  are permanent below the stated 20-value/metadata trigger.
- **No workflow changes** — §4's state machine is final.
- **No API redesign** — §8's endpoint list is the complete required surface;
  additions from §8/§9's "Future" tiers may proceed independently without
  reopening this document, since they were anticipated here.
- **No migration redesign** — §10 is the only sanctioned procedure.

**Only bug fixes are permitted until after migration (§10) is accepted.** A
bug fix corrects an implementation that fails to match this specification; it
never changes what this specification says.

### Amendment procedure
If an implementer discovers this specification is genuinely insufficient —
not merely inconvenient — the correct action is to **stop and raise it**, not
improvise. An amendment requires: (1) the specific section and field/decision
in conflict, (2) why the frozen decision cannot be satisfied as written, (3) a
proposed change scoped as narrowly as possible. Approved amendments are
appended to this document with a dated changelog entry, never silently
edited in place.

---

*This is the authoritative specification. Where any other document in this
repository (`docs/DATABASE.md`, `docs/SCHEMA_GAP_AUDIT.md`,
`docs/FEATURE_PARITY_PLAN.md`, `docs/ARCHITECTURE.md`) appears to conflict
with this one, this document governs.*
