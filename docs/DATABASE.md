# Database

## Status

Database engine is **finalized**: Supabase (PostgreSQL). As of Sprint 1, the API connects to Postgres via a SQLAlchemy engine and exposes a connectivity check at `GET /health`. The schema below was **designed** through four passes (Sprint 2 and 2.5) and is now **implemented** (Sprint 3) as SQLAlchemy models (`api/app/db/models.py`) and a first Alembic migration (`api/alembic/versions/0001_initial_schema.py`), matching this document field-for-field. The migration has not yet been applied to any real database — no Supabase project is connected in this environment. No CRUD endpoints, business logic, or seed data exist yet.

## Stack

- **Supabase** — hosted PostgreSQL, providing the database plus (likely) auth and storage as the platform grows.
- **SQLAlchemy 2** — ORM / database toolkit, used from the `api/` backend (`api/app/db/session.py`).
- **Alembic** — migration tool, used to version and apply schema changes. Not yet initialized — will be set up when the first model is introduced (Sprint 3+).
- **psycopg 3** — PostgreSQL driver used by SQLAlchemy to connect to Supabase.

## Connection

The API reads a single `DATABASE_URL` environment variable (see `api/.env.example`) in the form:

```
postgresql+psycopg://<user>:<password>@<host>:<port>/<database>
```

This is not committed — each environment (local, staging, production) supplies its own via `.env` or platform environment variables.

---

## Source material

This design is based on a review of `current_workspace.json`, the most recently modified file in the supplied workspace (`lastSaved: 2026-07-15`), containing 451 venues, 187 beaches, 25 destinations, 22 districts, and related curation data. Older snapshots in the same workspace and `sahelspot_data_lab.html` were not used, per instruction — the workspace's own curation tool is legacy implementation, not business data. This document models **the product** (a North Coast destination/venue directory), not the DataLab tool that assembled the data behind it.

---

## Design decisions

### Primary keys: preserve existing stable IDs, no UUIDs, no new surrogate integers

The previous revision moved everything to `bigint identity` surrogate keys, rejecting UUIDs but still discarding the source system's own identifiers. Re-examined per this review: the source data already has IDs, and some of them are genuinely stable and trustworthy.

| Option | Pros | Cons |
|---|---|---|
| **UUID** | Globally unique with no coordination; safe for multi-writer/offline systems. | Solves a problem this project doesn't have — one Postgres database, no microservices, no offline clients. Illegible in `psql`, larger indexes, requires an extension, and throws away IDs that already exist and are already referenced elsewhere (exports, CSVs, activity logs). |
| **New surrogate integer** (`bigint identity`) | Simple, small, sortable by creation order. | Still means every existing row needs a brand-new ID at migration time — a full remap, breaking any external reference to today's `v00033`-style IDs, for no real gain over just keeping them. |
| **Preserve existing natural ID** | No remap needed; today's `v00033`, exports, and support conversations about "venue v00033" keep working unchanged; human-legible; still a normal, indexable Postgres `text` column. | Slightly larger than an integer (immaterial at hundreds/low-thousands of rows); only works where the source ID is *actually* stable — not all of them are. |

**Decision: preserve existing IDs as primary keys, per-table, based on how trustworthy each one actually is** — this isn't uniform, because the source data isn't uniformly consistent:

- **`venues.id`**: preserved as-is (`v00033`, `v00452`, ...). This scheme is genuinely reliable — all 451 live venues, 353 pending, and 8 rejected records share one consistent sequence with no collisions. Real reason to keep it: it's already referenced throughout the workspace's own history (activity logs, merge reports), so preserving it keeps that trail meaningful instead of orphaning it.
- **`destinations.id`**: **not** preserved as the raw `dest00009`-style sequence — this is the "very strong reason" exception. The source data has *two conflicting* destination ID schemes (`destinations[].id` = `dest00009`, but `districts[].destination_id` and `registry[].id` = `dest-marassi`), and they disagree on which destinations even exist (see [Ambiguities](#ambiguities-found-in-the-workspace)). Neither raw scheme is safe to preserve as-is. Instead, `destinations.id` = the destination's **slug** (e.g. `marassi`, `hacienda-bay`) — not a new invented value, but the one identifier the source data itself already treats as authoritative: destination notes explicitly call slugs "frozen," and slug is the only identifier that resolves correctly across every collection that references a destination. This still honors "preserve what's already stable," just not the specific column that happened to be called `id` in the source.

Practical effect: no separate `slug` column is needed on `destinations` — the primary key *is* the slug, so there's one field doing one job instead of two fields that would always be redundant. `venues` still needs both `id` (opaque, preserved, not meant to be pretty) and a separate `slug` (URL-facing, human-readable) since venue slugs aren't unique/clean enough yet to serve as a primary key (see [Constraints](#constraints)).

### Beaches: not a separate entity — `category = 'Beach'`

Unchanged conclusion, restated plainly: a beach is a venue whose category is "Beach." The source data already treats `beach_club` as one category value among many, and roughly a quarter of beach records share an exact name with an existing venue record. Advantages of folding beaches into `venues` rather than a separate table:

- **One table to query, filter, and reason about** — "show me everything in Hacienda Bay" doesn't need to know or care whether an item is a restaurant or a beach; it's the same `WHERE destination_id = ...` query either way.
- **No nullable, perpetually-ambiguous relationship.** The prior design's `beaches.venue_id` (nullable FK, "maybe this beach is also a venue") is gone — there's no second row to reconcile against, because there's no second table.
- **Category filtering ("show me beaches in this destination") works exactly like every other category filter** — no special-cased query path for beaches versus restaurants versus hotels.
- **Beach-only facts don't bloat other rows.** They live in one JSONB column (`beach_details`) that's simply `null` for the ~75% of venues that aren't beaches — see [Images](#images) and the `venues` table below for the pattern.

### Categories: a small, fixed, flat list — not a table

The brief asks for exactly eight categories (Restaurant, Cafe, Hotel, Beach, Nightlife, Shopping, Services, Entertainment). The source data's 63 raw category strings are messy, but the mess is almost entirely at the *subtype* level ("seafood restaurant," "italian restaurant," "syrian restaurant" are all still restaurants) — the **top-level list is small and closed**. A lookup table earns its cost when a value set changes often and needs attached metadata; eight product-defined categories that map cleanly onto a fixed information architecture don't meet that bar.

**Decision: `venues.category` is a plain `text` column, constrained to a documented set of values** (the eight above, plus `Other` as a safety valve — the source data already has a handful of venues that don't cleanly fit any bucket). No `venue_categories` table, no FK, no join required to filter or display by category.

**Trade-off, stated plainly**: a lookup table would let a category carry its own icon, display order, or localized name, and would let a rename happen in one place instead of many rows. None of that is needed today. If categories later need attached metadata, or the list grows past roughly 15–20 values, that's the trigger to promote `category` into its own table — not before. Flagged again in [Final Recommendations](#final-recommendations) as the one part of this design most likely to need revisiting.

The finer-grained subtype information ("Italian," "Seafood") that the source data carries is not modeled now — it's a nice-to-have for filtering/search later, easy to add as a single nullable `cuisine` text column on `venues` without touching anything else, whenever it's actually needed (see [Future-proofing](#future-proofing)).

### Images: two columns, no table

The source `covers` collection, once stripped of its production-workflow tracking (sourcing status, priority, "last checked" — already excluded as tooling in the prior review), reduces to one real fact per venue: a cover image URL, plus occasionally a gallery. There's no per-image metadata in the source worth preserving (no captions, alt text, or custom ordering).

**Decision**:
- `venues.cover_image_url` — `text`, nullable.
- `venues.gallery_image_urls` — `text[]`, nullable — a flat list of URLs, in display order. A plain array, not JSONB, since it's just strings with no nested structure.

No `venue_images` table. If galleries later need per-image captions, alt text, or independent ordering/reordering, that's the trigger to promote this into a real table (`venue_images(venue_id, url, sort_order, caption, ...)`) — not before.

### Opening hours: JSONB, not a normalized table

| | Option A — normalized table | Option B — JSONB column |
|---|---|---|
| Shape | `venue_opening_hours(venue_id, day_of_week, opens_at, closes_at)` | `venues.opening_hours jsonb` |
| Read pattern | Requires a join every time a venue is displayed (hours are shown on essentially every venue page). | Comes back with the venue row — no join for the overwhelmingly common case of "show this venue's hours." |
| Query pattern it optimizes for | SQL-level filtering like "what's open right now" across many venues. | Not optimized for that — would need to fetch a candidate set (by destination/category) and check hours in application code. |
| Complexity | A new table, a FK, and insert/update logic for up to 7 rows per venue just to represent one fact. | One column; the "is it currently open" logic lives in the API layer, next to the rest of the display logic. |
| Fits current usage? | The source data doesn't have opening hours at all yet — no evidence "filter by open now" is a real, load-bearing query today. | Yes — matches how every other genuinely-1:1, fetched-whole fact in this schema is modeled (`boundary`, `beach_details`). |

**Recommendation: Option B, JSONB.** Structure as a day-keyed object of open/close pairs (arrays, to allow a lunch/dinner split), `null` meaning "not yet collected." This is consistent with the pattern already used for `boundary` and `beach_details`: data that's read as a whole unit with its parent row, not independently filtered or joined. If "what's open right now" becomes a real, frequently-used query (not just a nice display detail), that's the trigger to add a normalized table then — Postgres migrations are cheap; premature normalization isn't.

### Editorial status: one shared vocabulary, renamed to avoid colliding with the new meaning of "publish"

The prior revision used `draft` / `review` / `published` / `archived` as the row-level status on both `destinations` and `venues`, with `published` meaning "visible to end users." That was fine on its own, but the new product decision changes what "publish" means: publishing is no longer a per-row flag, it's an explicit, whole-of-site action that creates a **publish revision** (see [Publishing model](#publishing-model) below). A row can now be fully approved and ready, yet not actually live yet, because nobody has run Publish since it was approved — which means calling that row state `published` would be actively misleading.

**Decision: rename the terminal working state from `published` to `approved`.** Both `destinations.status` and `venues.status` now use — `draft`, `review`, `approved`, `archived`. This maps directly onto the requested workflow:

- **Edit** → the row is being worked on.
- **Save Draft** → `status = draft`.
- **Validate** → not a stored status — an application-level gate (required fields present, valid category, coordinates in range, etc.) that must pass before a row can move from `draft` to `review`. Modeling it as a gate rather than a fifth status avoids inflating the state machine for something that's really a pass/fail check, not a state a row sits in.
- **Review** → `status = review`, a human approval queue.
- (approval) → `status = approved` — ready to be included the next time someone publishes, but **not yet live**.
- **Publish** (the action) → gathers every `approved` row across both tables and freezes them into a new publish revision (see below).
- **Published** → the outcome: that revision is now the one the public path reads.
- **Website** → reads only the current publish revision, never `destinations`/`venues` directly.

This also removes the need for a separate `venues.visibility` field (`public`/`hidden`) — visibility is now answered structurally (is this content in the current published revision?), not by a flag on the working row. Source data maps onto the renamed vocabulary the same way it did before (`live` → `approved`, `staged`/`pending` → `review`, `planning`/`data_only` → `draft`, `legacy`/`rejected` → `archived`) — see [Final Recommendations](#final-recommendations) for why this mapping is still a judgment call, not a mechanical transform.

**The mechanism this decision requires — whole-dataset publish revisions — is described in full under [Entities](#publish_revisions) below**, since it's now one of the schema's tables, not just a design note.

---

## Entities

### `destinations`

**Why this table exists**: the top-level place a user browses by — a named compound/resort/development along the North Coast. Every venue belongs to exactly one. **Still necessary**: yes — this is the primary navigation structure of the whole product; there's no simpler representation that doesn't lose that.

| Field | Type | Notes |
|---|---|---|
| `id` | text, PK | The destination's slug (e.g. `marassi`). See [Primary keys](#primary-keys-preserve-existing-stable-ids-no-uuids-no-new-surrogate-integers). |
| `name` | text, required | Display name, e.g. "Marassi". |
| `region` | text, required | Broad corridor grouping, e.g. "Sidi Abdelrahman Area" — 5 known values today. Plain text; not a table (see prior review's reasoning, unchanged — too small and static to justify one). |
| `status` | text, required | `draft` \| `review` \| `approved` \| `archived`. See [Editorial status](#editorial-status-one-shared-vocabulary-renamed-to-avoid-colliding-with-the-new-meaning-of-publish). Reaching `approved` makes a row eligible for the next publish — it does not by itself make it visible on the website. |
| `aliases` | text[], nullable | Alternate names this destination is known by (e.g. `{"New Alamein"}` for "New Alamein City") — a real, demonstrated naming-inconsistency problem in the source data, worth keeping for search/matching. |
| `boundary` | jsonb, nullable | Approved boundary polygon plus its own status/source/approval metadata, fetched and rendered as one unit (only 12/25 destinations have one today). |
| `notes` | text, nullable | Free-text admin notes. |
| `last_published_at` | timestamptz, nullable | Set whenever this row was last included in a publish revision. Lets the admin UI show "unpublished changes" (when `updated_at` is more recent than `last_published_at`) without inspecting revision snapshots. |
| `created_at` / `updated_at` | timestamptz | |

**Relationships**: one destination → many venues.

---

### `venues`

**Why this table exists**: the core entity — every specific place a user can find (restaurant, hotel, shop, activity, nightlife spot, or beach) within a destination. **Still necessary**: obviously — it's the product's primary content.

| Field | Type | Notes |
|---|---|---|
| `id` | text, PK | Preserved from source (`v00033`-style). See [Primary keys](#primary-keys-preserve-existing-stable-ids-no-uuids-no-new-surrogate-integers). |
| `name` | text, required | |
| `slug` | text, required | URL-facing, human-readable. Unique per destination (source data currently violates this — see [Constraints](#constraints)). |
| `destination_id` | text, FK → `destinations.id`, required | |
| `district` | text, nullable | Sub-area label within the destination (e.g. "Central", "Marina"). Plain text, not a FK — ~69% of source venues have none, and it's a descriptive label, not a governed entity. |
| `category` | text, required | `Restaurant` \| `Cafe` \| `Hotel` \| `Beach` \| `Nightlife` \| `Shopping` \| `Services` \| `Entertainment` \| `Other`. See [Categories](#categories-a-small-fixed-flat-list--not-a-table). |
| `status` | text, required | `draft` \| `review` \| `approved` \| `archived`. Same shared vocabulary as `destinations.status` — `approved` means ready-to-publish, not yet necessarily live. |
| `is_featured` | boolean, default false | Homepage/curation lever. |
| `is_verified` | boolean, default false | Trust signal shown to users. |
| `latitude` | numeric(9,6), nullable | |
| `longitude` | numeric(9,6), nullable | |
| `phone` | text, nullable | |
| `whatsapp` | text, nullable | |
| `website` | text, nullable | |
| `maps_url` | text, nullable | |
| `instagram_handle` | text, nullable | |
| `facebook_handle` | text, nullable | |
| `tiktok_handle` | text, nullable | |
| `short_description` | text, nullable | |
| `cover_image_url` | text, nullable | See [Images](#images-two-columns-no-table). |
| `gallery_image_urls` | text[], nullable | See [Images](#images-two-columns-no-table). |
| `opening_hours` | jsonb, nullable | Not in current source data; designed now. See [Opening hours](#opening-hours-jsonb-not-a-normalized-table). |
| `beach_details` | jsonb, nullable | Only populated when `category = 'Beach'`: public access, QR requirement, day pass, food/watersports/family/parking availability, confidence, Google Place ID. |
| `internal_notes` | text, nullable | Admin-only. Also carries the rare "why archived/rejected" note that had its own dedicated column two revisions ago (used by only 2/451 source rows — not worth a column). |
| `source` | text, nullable | Free-text import provenance, kept for traceability, not a FK. |
| `last_published_at` | timestamptz, nullable | Same purpose as `destinations.last_published_at` — surfaces "unpublished changes" in the admin UI. |
| `created_at` / `updated_at` | timestamptz | |

**Relationships**: many venues → one destination.

---

### `publish_revisions`

**Why this table exists**: it's the mechanism behind the platform's draft → publish decision (see [`PRODUCT.md`](PRODUCT.md#content--publishing-model)) — the entire reason the public website can be guaranteed to only ever show published data, with instant rollback to any previous publish. Unlike `destinations`/`venues`, it doesn't model a business concept — it's the audit trail and safety net for the act of publishing itself. **Still necessary**: yes, this table *is* the "public site must only read published data" requirement; without it, that guarantee would depend on application code being correct every time, not on the data model.

**Shape of the solution: whole-dataset snapshots, not per-row history.** The alternative — versioning every individual row the way a wiki or WordPress tracks post revisions — would allow rolling back one venue independently of everything else, but that's complexity nothing in the brief asked for: the requirement is "roll the whole site back to how it looked at a previous publish," not "restore just this one venue." A single immutable snapshot per publish satisfies that directly, with one new table instead of a parallel history table per existing table.

**How it works**:

1. An editor (or an automated process, eventually) triggers **Publish**.
2. The system collects every `destinations` and `venues` row currently `status = approved`, and writes them — as they are right now — into a new `publish_revisions` row as a single JSON snapshot. This snapshot is **immutable**: once written, a revision is never edited, only superseded by a newer one or restored via rollback.
3. The new revision is marked as the **current** one. The public website and public API read *only* the current revision's snapshot — they never query `destinations`/`venues` directly (see [`ARCHITECTURE.md`](ARCHITECTURE.md#publishing-architecture)).
4. **Rollback** = pick any older revision and mark it current instead. No data is copied, mutated, or recomputed — the older snapshot already contains everything the website needs, so this is a single flag flip, effectively instant.

| Field | Type | Notes |
|---|---|---|
| `id` | bigint identity, PK | No legacy ID to preserve — this concept doesn't exist in the source data, unlike `destinations`/`venues`. |
| `snapshot` | jsonb, required | The full frozen content of every `approved` destination and venue at the moment of publish. |
| `is_current` | boolean, required, default false | Exactly one revision is current at a time — enforced with a partial unique index (`WHERE is_current`), not application logic alone. |
| `published_at` | timestamptz, required | |
| `published_by` | text, nullable | Who triggered it. References a future user/admin concept — not modeled yet (auth is still an open decision, see `ARCHITECTURE.md`). |
| `label` | text, nullable | Optional human note, e.g. "Pre-launch content freeze." |
| `destination_count` / `venue_count` | integer, nullable | Denormalized counts, purely for a fast admin revision-history list (`"Revision #14 — 26 destinations, 812 venues"`) without parsing the full snapshot. Convenience, not a source of truth. |

**Relationships**: none (no FK in or out) — a revision is a point-in-time copy, deliberately disconnected from the live working rows so that editing or even deleting a draft row later can never alter historical published content.

**Trade-off, stated plainly**: storing a full copy of the dataset on every publish is not the storage-minimal approach — an incremental diff-based history would use less space. At this product's scale (low thousands of rows, each a few hundred bytes to a couple KB), a full snapshot is a few hundred KB to low single-digit MB per revision — trivial for Postgres, and dramatically simpler to reason about and roll back instantly. If publish frequency ever gets high enough that storage genuinely matters, a retention policy (keep the last N revisions, or the last one per day/week) is a simple addition later — not a reason to build incremental diffing now.

---

That's the complete schema: **three tables** — `destinations` and `venues` model the product's content, and `publish_revisions` is the mechanism that makes the draft → publish architecture real. Every other concept from earlier passes — regions, destination aliases, destination boundaries, districts, venue categories, beaches, opening hours, images — is a column, not a table, because none of them are independently queried, independently joined against by a third table, or carry enough of their own identity to need one.

---

## Explicitly excluded from the schema

Unchanged from prior reviews — these source collections are internal state of the DataLab curation tool (import bookkeeping, QA dashboards, audit trails, dedup caches, a conflicting second destination registry), not facts about the product:

`sources`, `registry`, `qa_flags`, `activity_log`, `merge_history`, `last_merge_report`, `boundaryReviews`, `venue_map`, `instagram`, `social`, `covers` (beyond the cover URL itself), `aliases.non_aliases`.

`districts`, `regions`, `destination_boundaries`, `destination_aliases`, `beaches`, and `venue_categories` are not excluded — they're modeled as columns on `destinations`/`venues` instead of tables, per [Design decisions](#design-decisions) above. `pending_venues` and `rejected_venues` fold into `venues.status` (as `draft`/`archived` respectively — see [Editorial status](#editorial-status-one-shared-vocabulary-renamed-to-avoid-colliding-with-the-new-meaning-of-publish)).

---

## Constraints

**Uniqueness**:
- `destinations.id` — primary key (the slug), inherently unique.
- `venues.id` — primary key (preserved source ID), inherently unique.
- `venues.(destination_id, slug)` — unique per destination. **Not yet true of the source data** — 46 duplicate/blank `vslug` values exist today, including 3 collisions within the same destination. Needs a data-cleaning pass before this constraint can be enforced; see [Final Recommendations](#final-recommendations).
- Google Place ID (inside `beach_details`) is not enforced unique at the database level, since it lives in JSONB rather than its own column — a deliberate simplicity trade-off. A Postgres expression index can add this back later without a schema change, if duplicate-beach detection becomes a real problem.
- `publish_revisions`, at most one row with `is_current = true` — enforced with a partial unique index (`CREATE UNIQUE INDEX ... ON publish_revisions (is_current) WHERE is_current`), not left to application logic alone. This is the constraint that makes "the public website has exactly one source of truth at any moment" a database guarantee, not just a convention.

**Required fields**: as marked `required` above — fields populated on 100% of source rows (`name`, `category`, `status`, destination linkage) versus fields frequently empty in source and thus nullable.

**Validation rules** (application-level, not DB-level unless noted):
- `latitude`/`longitude`, when present, roughly within [30.6, 31.1] / [28.6, 29.4] — the observed range of all current venue coordinates; a sanity bound, not a hard constraint.
- Coordinates must be stored as numeric types. **Source data violates this today** — ~26% of venues have coordinates stored as strings. A migration-time coercion, not a schema decision.
- `venues.category` and `destinations.status` / `venues.status` restricted to their documented value sets — enforceable with a `CHECK` constraint (simple, and avoids native `ENUM` types, which require an `ALTER TYPE` migration to extend; this schema will likely gain values over time, e.g. new categories).
- "Validate" (the workflow step between Save Draft and Review) is an application-level gate, not a DB constraint: required fields present, `category` in the documented set, coordinates in range, etc. It runs before a row can move from `draft` to `review` — see [Editorial status](#editorial-status-one-shared-vocabulary-renamed-to-avoid-colliding-with-the-new-meaning-of-publish).
- `publish_revisions.snapshot` must never be updated after insert — revisions are append-only. Worth a database-level safeguard (e.g. a trigger rejecting `UPDATE`/`DELETE` on that column) in addition to the application never issuing one, since this immutability is what makes rollback trustworthy.

**Referential integrity**: `venues.destination_id` is `NOT NULL` with `ON DELETE RESTRICT` — a destination shouldn't disappear out from under venues that reference it. `publish_revisions` intentionally has no foreign keys at all, in either direction — see its entity description above for why.

---

## Indexes

| Index | On | Why |
|---|---|---|
| `venues(destination_id)` | FK | The single most common query — "all venues in this destination." |
| `venues(category)` | plain | Category filtering, across or within a destination. |
| `venues(status)` | plain | Editorial queues filter by stage (e.g. "everything in `review`"). Note this is **not** how the public site decides what's visible — that's answered entirely by `publish_revisions`, not by querying `venues.status` at read time. |
| `venues(latitude, longitude)` | composite (or GIST if PostGIS) | Geolocation / map-bounds queries. A plain composite is enough for now; PostGIS is a later upgrade if proximity search grows. |
| `venues USING gin (to_tsvector('simple', name))` | GIN | Name search — venue names are frequently Arabic/English mixed and inconsistently cased; a plain B-tree won't serve "search as you type." Deferred until AI Search is scoped, but worth planning the index type now. |
| `publish_revisions(is_current) WHERE is_current` | partial unique | Both the uniqueness guarantee above and the fast lookup the public API runs on effectively every request — "what's the current revision." |
| `publish_revisions(published_at)` | plain | Ordering the admin revision-history list, newest first. |

---

## Future-proofing

No feature below is implemented in this design. Each note is why the schema doesn't need a structural rework when the feature arrives.

**One distinction the publish-revision model introduces**: `destinations`/`venues` hold *editorial* content — written by the team, subject to draft → publish. The features below are mostly *user-generated* content, which is a different kind of data with a different lifecycle (typically always-live, not curated through Draft/Review/Publish). None of them need to go through `publish_revisions` — they'd read/write live, same as any normal table, referencing `venues.id`/`destinations.id` for context. Worth stating explicitly now so it's a deliberate choice later, not an accidental gap.

- **Reviews**: a new `reviews` table (`venue_id` FK, `user_id` FK, `rating`, `body`, `created_at`). User-generated, always-live — not part of the publish workflow. `venues` carries no raw scraped rating data to conflict with it.
- **Events**: a new `events` table (`destination_id` or `venue_id` FK, `title`, `starts_at`, `ends_at`). Editorial content, like venues — plausibly should go through the same draft → publish workflow rather than being always-live; worth deciding when this feature is actually scoped.
- **Offers**: a new `offers` table (`venue_id` FK, `title`, `discount`, `valid_from`/`valid_to`). Same open question as Events — editorial, so plausibly publish-workflow content too.
- **Favorites**: a join table `user_favorites(user_id, venue_id)`. User-generated, always-live. Needs nothing from `venues` beyond its PK.
- **AI Search**: benefits from `destinations.aliases` (a real alternate-name index) and the small fixed `category` list (clean values to facet/filter on, not free text). A future embeddings/vector column or table attaches to `venues.id` without touching existing columns. Should index the *published* snapshot, not the draft tables — search results are public-facing, so they're bound by the same "only published data" rule as the website. A `cuisine` text column (mentioned in [Categories](#categories-a-small-fixed-flat-list--not-a-table)) can be added the same way, whenever finer-grained search matters.
- **Mobile App**: consumes the same public API as the web app, which already only reads published data — no additional schema implication.
- **Booking**: a new `bookings` table (`venue_id` FK, `user_id` FK, `status`, time-slot fields). User-generated/transactional, always-live. Kept separate since booking rules are category-specific (a restaurant table booking vs. a beach day-pass are different shapes) and shouldn't force decisions onto `venues` now.

Text primary keys don't block any of this — every new table above just needs a plain `text` FK column referencing `venues.id` or `destinations.id`, no different in practice from an integer or UUID FK.

---

## Ambiguities found in the workspace

Unchanged from prior reviews — none are about table structure, so this simplification doesn't resolve them:

1. **Two conflicting destination ID schemes** (`destinations[].id` vs. `districts[].destination_id`/`registry[].id`), which disagree on which destinations exist. Addressed structurally by using slug as `destinations.id` (see [Primary keys](#primary-keys-preserve-existing-stable-ids-no-uuids-no-new-surrogate-integers)), but someone still needs to confirm the final destination list.
2. **Orphaned boundary data** — a "Ghazala Bay" boundary (inconsistently cased, listed twice) for a destination that doesn't exist in either source destination list.
3. **Beach ↔ venue overlap** — 48 of 187 beach records share an exact name with an existing venue. No longer a schema question (they're the same table now), but still a migration-time de-duplication question.
4. **`venues.category` source data mixes two taxonomy levels** with casing drift; the mapping from 63 raw strings down to the 8 (+ `Other`) canonical categories needs a human pass, not just a mechanical lowercase-and-dedupe.

---

## Questions before the first migration

1. Confirm the final destination list (Ambiguity 1).
2. Enable PostGIS now (for `boundary`'s geometry and geolocation indexing), or defer?
3. Is "Ghazala Bay" a missing destination to add, or dead data to drop?
4. How should the 46 duplicate/blank venue slugs be resolved before the uniqueness constraint can be enforced?
5. Which of the 48 name-matching beach/venue pairs should collapse into a single row during migration, and which are coincidentally similar names for different places?
6. Review and sign off on the 63-raw-string → 8-category mapping (Ambiguity 4) before it's baked into a migration.
7. Should the very first migration seed an initial `publish_revisions` row (a "day zero" publish of whatever's approved at migration time), or should the site have no current revision — and thus nothing publicly visible — until the first real Publish happens? Affects whether the public API needs to handle "no current revision exists yet" as a real, expected state.
8. Is publishing all-or-nothing (the whole approved dataset, as designed) sufficient for launch, or is scoped/partial publishing (e.g. "just publish this one destination's changes") needed sooner than "later"? The current design deliberately only supports all-or-nothing — see [`ARCHITECTURE.md`](ARCHITECTURE.md#decisions-still-open).
9. Should `events`/`offers` (mentioned in [Future-proofing](#future-proofing)) go through the same draft → publish workflow as `venues`, or be always-live like reviews/favorites? Worth deciding when those features are actually scoped, but flagged now since it affects whether they're "editorial" or "user-generated" content.

---

# Final Recommendations

Things worth changing or watching before the first migration, beyond what's already flagged above:

1. **`category` as text+CHECK, not a table, is the one decision most likely to be revisited.** It's the right call for launch (8 fixed values, no attached metadata needed yet), but if the product later wants per-category icons, ordering, localized labels, or the list grows past ~15–20 values, promote it to a real lookup table then. Not a reason to build it now.
2. **Venue slug cleanup is a prerequisite, not a nice-to-have.** The `venues.(destination_id, slug)` uniqueness constraint can't be turned on until the 46 duplicate/blank slugs in the source data are resolved. This should happen as an explicit data-cleaning step in the migration script, not be silently skipped.
3. **The `draft → review → approved → archived` mapping from today's messier source statuses is a judgment call**, not a mechanical transform (particularly `legacy` and `data_only`, which don't map onto the new vocabulary as cleanly as `live` → `approved` does). Worth a quick sanity check against a sample of real rows before the migration runs, not just trusting the mapping described above.
4. **Decide on PostGIS now rather than later.** It's the one infrastructure choice that's cheaper to make before the first migration than to retrofit — `boundary` and the geolocation index both change shape depending on the answer.
5. **`cuisine`/subtype (e.g. "Italian," "Seafood") was deliberately left out.** It's real information in the source data that this design doesn't lose (it's still sitting in the raw category strings), just doesn't model yet. Worth picking back up as a single nullable column as soon as search or filtering needs it — flagged here so it isn't forgotten, not because it needs to happen now.
6. **No `visibility` field.** Confirmed intentional (folded into `status` plus the publish-revision mechanism), but flagging it explicitly in case a real "temporarily hide one published venue without a full new publish" need surfaces during build-out — that's a narrower feature than it sounds (probably: a per-venue override checked at the public API layer, not a schema change) and worth designing deliberately if it comes up, not bolting on reactively.
7. **The `is_current` partial unique index is load-bearing, not decorative.** It's what turns "the website has exactly one source of truth" from a convention the application is supposed to follow into something the database itself guarantees. Worth treating as a required part of the first migration, not an optional hardening step added later.
8. **Snapshot immutability (`publish_revisions.snapshot` is never updated after insert) should be enforced, not just assumed.** The whole rollback guarantee depends on old revisions genuinely being untouched. A DB-level safeguard (trigger or equivalent) is cheap insurance against a future bug in admin tooling silently corrupting history.
9. **No retention policy on `publish_revisions` yet, and that's fine for now.** Every publish keeps its snapshot forever under this design. At current data volume that's not a real cost, but it's worth a one-line decision (e.g. "keep everything," "keep last 90 days") before this has been running long enough for it to become a surprise.
