# SahelSpot Platform Specification — v1.0 (FROZEN)

**This document supersedes `PLATFORM_SPEC_v1_FINAL.md`, `PLATFORM_SPEC_REVIEW.md`,
`SCHEMA_GAP_AUDIT.md`, `FEATURE_PARITY_PLAN.md`, and `DATABASE.md` in their
entirety.** Those documents remain as historical record of how this
specification was reached. Where any of them conflicts with this document,
**this document governs, without exception.**

**No code, schema, migration, or SQL was written to produce this document.**

**Scope of this document:** resolve every finding raised in
`PLATFORM_SPEC_REVIEW.md` against `PLATFORM_SPEC_v1_FINAL.md`. This is a
closure exercise, not a redesign — every entity, workflow, and API decision
in the prior spec that the review did **not** challenge is carried forward
unchanged and is not repeated in full here except where a resolution requires
restating the field it touches.

---

## How this document is organized

- **§1–6**: the six findings the closure task named explicitly, resolved in
  full depth, each with a defined invariant/model/policy sufficient that no
  future document needs to answer the same question again.
- **§7**: every remaining finding from the review, resolved in the same
  quote → accept/reject → decision → spec update → why-closed format, at
  a scope proportional to its severity.
- **§8**: Freeze Verification.
- **§9**: Verdict.

---

## 1. Referential Closure

> **Review finding (§1.4, Critical):** *"`publish()` gathers destinations and
> venues as two independent queries. Nothing requires that a venue's parent
> destination is also `approved` at publish time. ... the resulting snapshot
> then contains a venue whose `destination_id` does not match any entry in
> that same snapshot's `destinations` array."*

**Accepted.**

### 1.1 The invariant

**A publish snapshot must never contain a venue whose `destination_id` does
not also appear in that same snapshot's `destinations` array.** This is now
a hard, permanent property of every publish revision — not an aspiration, a
guarantee the publish mechanism must enforce mechanically, every time.

### 1.2 Validation rules

Two layers, not one — the review's finding was specifically that a single
approval-time check is not sufficient against later drift (a destination
archived *after* one of its venues was already approved):

1. **Approve-time gate (prevention).** `POST /editor/venues/{id}/approve`
   (single and bulk) now additionally requires `destination.status =
   'approved'`. A venue whose destination is `draft`, `review`, or
   `archived` **cannot** be approved — rejected with `422`, error code
   `destination_not_approved`, naming the destination's current status. This
   closes the common case at the point of editor action, where it's cheapest
   to catch and easiest to explain.

2. **Publish-time filter (closure guarantee).** The publish query itself
   changes from two independent filters to a single join condition:

   > Gather every `venue` where `venue.status = 'approved'` **and**
   > `venue.destination.status = 'approved'`.

   This is what actually makes the invariant unconditional — it holds even
   if a destination is archived *after* one of its venues was already
   validly approved (drift the approve-time gate cannot see, because it
   only runs once, at approval time).

### 1.3 Publish failure behavior

**A drifted venue does not fail the publish.** It is silently excludable at
the level of a single row, but never silent at the level of the operation:

- The venue is **excluded** from the snapshot (not published this cycle).
- The publish response (`PublishRevisionOut`, §2.5 of the prior spec, field
  set otherwise unchanged) gains one new field: `excluded_venue_count: int`
  — `0` in the overwhelmingly common case, otherwise the number of venues
  held out this cycle for this reason.
- Each exclusion is recorded to `activity_log` (`action:
  "publish_excluded_orphan_venue"`, `entity_type: "venue"`, `entity_id`,
  `metadata: {destination_id, destination_status}`) — so it is visible in
  the existing Activity page with zero new UI surface required.

**Rationale for exclude-not-fail:** one drifted row blocking the entire
site's publish for every other approved destination and venue would be a
far worse outcome than quietly holding one venue back — and "quietly" here
specifically does not mean "silently," because of the logged exclusion and
the non-zero counter. A publisher who sees `excluded_venue_count: 3` has
exactly what they need to go look at the Activity log and fix the underlying
state (re-approve the destination, or re-submit the venue) before the next
publish.

### 1.4 Why this is now closed

The invariant is unconditional (enforced at publish time, not merely at
approval time), the failure mode is defined precisely (exclude + count +
log, never a whole-publish failure), and no new table or column is required
— `activity_log` and `PublishRevisionOut` already exist and only gain a
field/action-type each. This is implementable exactly as specified, with no
further design decision left open.

---

## 2. Beach Contradiction

> **Review findings (§1.3, High; and the underlying §0/§6.4 gap):** *"Beach
> identity derivation is deferred, not decided... §6.4 states identity
> derivation... 'is specified in §10, not here.' §10.4 then says the actual
> rule will be written down in the migration runbook before the script runs.
> No runbook exists. No derivation algorithm is given anywhere in this
> document."*

**Accepted.** This section is the complete, final, and only answer to every
question about beaches. No future migration document may add to or revise
what follows without a formal Specification Amendment (§9's procedure,
inherited unchanged from the prior spec).

### 2.1 Canonical model (restated, unchanged from the prior spec — not in
dispute, included here only so this section is self-contained)

A beach is a row in `venues` with `category = 'Beach'` and a populated
`beach_details` JSONB column. There is no `beaches` table, now or ever,
under this specification.

### 2.2 Canonical beach identity — the algorithm

For every legacy beach record, in the order it appears in the source export:

```
slug = slugify(record.name)
       # lowercase; transliterate/strip non-alphanumeric to "-";
       # collapse repeated "-"; trim leading/trailing "-"
       # (identical slugify rule already used for every other slug
       #  in this platform — no new algorithm introduced)

id   = f"{destination_id}-beach-{slug}"[:200]
       # truncated to 200 chars, matching the existing column width
       # used elsewhere in this schema
```

**Collision handling:** if the computed `id` already exists (in the target
table, or earlier in the same migration batch), append `-2`, `-3`, ... until
unique. This is deterministic and reproducible — running the derivation
twice against the same export produces the same ids, which is the property
the review's finding was actually about (two implementers reaching different
outcomes from the same "final" spec).

**Uniqueness enforcement:** the existing `UNIQUE(destination_id, slug)`
constraint on `venues` already covers beaches with zero schema change — `slug
= slugify(record.name)` (without the `{destination_id}-beach-` prefix,
which lives only in `id`) is what that constraint checks.

### 2.3 Import rules — the complete field mapping (final, no gaps)

| Legacy field | Venue field | Rule |
|---|---|---|
| `name` | `name` | Verbatim |
| `area` | `district` | Verbatim |
| `destination` | `destination_id` | Case-insensitive exact match against `destinations.name`. **Records that do not match any destination are excluded from migration entirely — never force-assigned a guessed destination.** As audited, this is exactly 3 of 187 legacy records: `Fouka`, `Ras El Hekma`, `Sidi Abdelrahman` (regional names with no matching destination row). These 3 are reported by name in the migration's verification output (§10.6 of the prior spec, unchanged) and are not migrated in this or any future run unless a destination matching one of those names is created first — at which point a **new, later, ordinary** migration run (not a spec amendment) picks them up, because the matching rule is exact-match-by-name, not a one-time snapshot decision |
| `type` | `beach_details.type` | Verbatim (nullable) |
| `publicAccess` | `beach_details.publicAccess` | Verbatim — always one of `"yes"`, `"no"`, `"unknown"` in the audited source |
| — | `category` | Always the literal string `"Beach"` |
| — | `id` | Per §2.2's algorithm |
| — | `slug` | Per §2.2's algorithm |
| — | `latitude`, `longitude` | **Always `NULL`.** The legacy source has no coordinate data for any beach record. `NULL` is the honest value; nothing is estimated or geocoded as part of this migration |
| — | `status` | `draft`, identical to every other migrated row — no beach is auto-approved |

### 2.4 Write path (v1 requirement, restated as final and non-negotiable)

- `PATCH /editor/venues/{id}` **must** accept a `beach_details` object in its
  request body whenever the venue's `category` is (or is being set to)
  `'Beach'`.
- Shape: `{"type": string | null, "publicAccess": "yes" | "no" | "unknown"}`.
  Any other shape, or a `beach_details` payload sent for a non-`Beach`
  venue, is rejected with `422`.
- The venue edit UI must expose `type` and `publicAccess` as editable fields
  precisely when `Beach` is the selected category — no separate "beach
  editor" screen, this is the ordinary venue edit form conditionally showing
  two more fields, consistent with the "one entity" model in §2.1.

**This must exist before the migration runs.** Importing a beach whose
`beach_details` can never afterward be corrected or completed through any UI
or API is not an acceptable v1 state.

### 2.5 Publish behavior

Identical to every other venue, with no special-casing: a beach is included
in a publish snapshot exactly when `status = 'approved'` **and** its
destination is also `approved` (§1's referential-closure rule applies to
beaches exactly as it applies to a restaurant or a hotel — no exception).
`beach_details` is included in the snapshot and in `PublishedVenueOut`,
exactly as the prior spec already stated.

### 2.6 Why this is now closed

Every question the review raised has a concrete, executable answer in this
section: the exact id/slug algorithm, the exact 3-record exclusion list by
name, the exact write-path requirement and its shape validation, and
confirmation that publish treats beaches with no special case. **No future
migration document is required, or permitted, to answer any of these
questions differently** — a genuinely different answer is a Specification
Amendment, not a runbook decision.

---

## 3. Database Indexing

> **Review finding (§2.1, High):** *"The spec... never mentions an index...
> At 100,000 venues, GET /editor/venues filtering by destination_id,
> category, or status... requires an index on each to avoid a sequential
> scan."*

**Accepted.**

### 3.1 Required indexes — final list

| Table | Index | Type | Purpose |
|---|---|---|---|
| `venues` | `destination_id` | B-tree | Destination-scoped venue lists; FK join performance |
| `venues` | `category` | B-tree | Category filter (`GET /editor/venues?category=`) |
| `venues` | `status` | B-tree | Workflow queries; the base of every publish-eligibility query |
| `venues` | `(destination_id, status)` | **Composite B-tree** | Serves §1.2's publish-time join directly — "approved venues for an approved destination" is exactly this composite's access pattern |
| `venues` | `(destination_id, slug)` | Unique B-tree | **Already exists** (uniqueness constraint) — noted here only for completeness; also serves beach-identity collision checks (§2.2) |
| `destinations` | `status` | B-tree | Workflow queries; the destination side of §1.2's join |
| `publish_revisions` | `is_current` (partial, `WHERE is_current`) | **Already exists** | Enforces the single-current-revision invariant |
| `publish_revisions` | `published_at DESC` | B-tree | Revision-history list ordering (newest first) — currently an unindexed sort |
| `venues` | `lower(name) gin_trgm_ops` | **GIN, trigram** | Search field — see §3.2 |

### 3.2 Search field indexing

The `q` parameter (`GET /editor/venues?q=`) performs `ILIKE '%...%'` against
`name` — a substring match, which a plain B-tree cannot accelerate at any
size. **Decision: a PostgreSQL trigram (`pg_trgm`) GIN index on
`lower(name)`, built now, not deferred.** The prior spec's silence on this
was itself the finding; the review asked that the deferral at least be
*named*, but given the fix is a single, cheap, additive index (not a schema
change, not a new search infrastructure), there is no reason to defer it
further under Principle 1.6 ("forward-compatible... include it now when it
exists cheaply").

This is **not** a move to a different search technology (Elasticsearch,
`tsvector`, etc.) — that remains explicitly deferred, with its own trigger
condition unchanged from the prior spec: revisit only when a real
requirement for ranked/fuzzy/multi-field search (not just accelerated
substring match) actually appears.

### 3.3 Why this is now closed

Every filter parameter the current API exposes has a named index. The one
composite index required by §1's referential-closure fix is specified
alongside the single-column indexes it's derived from, not left for an
implementer to infer. Search performance is addressed with the smallest
sufficient fix (a trigram index) rather than either ignoring it or
over-committing to new search infrastructure the product hasn't asked for
yet.

---

## 4. Concurrent Editing

> **Review finding (§2.3, High):** *"`PATCH /editor/venues/{id}` (Save Draft)
> has no optimistic-concurrency mechanism... Two editors opening the same
> draft venue and both saving produce silent last-write-wins data loss."*

**Accepted.**

### 4.1 The chosen model

**Optimistic locking, via HTTP `ETag`/`If-Match`, backed by an explicit
monotonically-incrementing integer `version` column.** Not pessimistic
locking (no lock-acquire/release semantics, no "this row is checked out by
X" UI state to build or explain — that is closer to the legacy field-locking
mechanism this platform's own Out-of-Scope list already rejects). Not a bare
`updated_at` timestamp comparison (timestamps can collide at low resolution
and carry no explicit "this is the Nth version" semantics an integer does).

This single choice applies to **both** `venues` and `destinations` — the
only two entities with real multi-editor contention. `publish_revisions`
rows are immutable and need no concurrency control; `app_users` is
low-contention, admin-only, single-field, and is explicitly **not** in scope
for this mechanism (kept simple deliberately, per Principle 1.6 — no
speculative consistency machinery where no real contention exists).

### 4.2 Schema change

`venues` and `destinations` each gain one column:

| Field | Type | Default | Editable |
|---|---|---|---|
| `version` | integer | `1` | No — incremented by the database itself on every update, never set directly by a client |

### 4.3 Protocol

- `GET /editor/venues/{id}` and `GET /editor/destinations/{id}` return an
  `ETag` response header, whose value is the row's current `version`
  (e.g. `ETag: "7"`).
- `PATCH /editor/venues/{id}` and `PATCH /editor/destinations/{id}` **must**
  carry an `If-Match` request header with the `version` the client last read.
- On a matching version: the update proceeds, `version` increments by
  exactly 1 as part of the same transaction as the field update.
- On a **missing** `If-Match` header: rejected, `428 Precondition Required`.
- On a **mismatched** `If-Match` value (someone else saved in between):
  rejected, `409 Conflict`, response body includes the row's *current*
  state and *current* `version` — enough for the client to show "this was
  changed by someone else" and let the editor reload and reapply their
  intended change, rather than guessing at a merge.

### 4.4 Conflict behavior — explicitly, no auto-merge

**There is no field-level merge.** A `409` always means: discard your
in-flight edit, reload the current state, decide what to do next as a human.
This is a deliberate simplicity choice, not an oversight — the legacy merge
engine (three-way diffs, "keep/use incoming," field locks) is already
Out of Scope (§11 of the prior spec, unchanged), and building conflict
*resolution* machinery here would be quietly reintroducing exactly the
tooling that section rejected. Optimistic locking's job is *detecting*
the conflict reliably, not *resolving* it automatically.

### 4.5 Why this is now closed

One mechanism is named (not left as a menu of options), it's scoped to
exactly the two entities with real contention, its wire protocol is fully
specified (header names, status codes, response shape on conflict), and its
relationship to the already-rejected merge engine is stated explicitly so a
future reader doesn't wonder whether "optimistic locking" is secretly
supposed to grow into something the platform has already said no to.

---

## 5. Internationalization

> **Review finding (§2.2, High):** *"No i18n primitive... This is not a
> hypothetical future need: the audited legacy export already contains
> Arabic-named venues... A North Coast Egyptian tourism platform serving
> both Arabic- and English-speaking audiences is a current, evidenced
> requirement, not a speculative one."*

**Accepted.**

### 5.1 Fields

`venues` and `destinations` each gain one column:

| Field | Type | Nullable | Shape |
|---|---|---|---|
| `translations` | JSONB | Yes, default `null` | `{"<locale>": {"name": string?, "short_description": string?}}` — e.g. `{"ar": {"name": "أبراج العلمين الجديدة"}}` |

This follows the exact same pattern already established and justified for
`opening_hours` and `beach_details`: a nested, per-row fact with no
independent identity, read as a whole with its parent row, never
independently joined or queried across rows.

`name` and `short_description` remain **required, canonical, single-value
columns** — the platform's default/fallback language of record (English, by
existing convention: every populated field in the audited data is in
English except where a venue's *only* real name is Arabic, which is
`translations.ar.name`'s job to carry, not a reason to make `name` itself
bilingual).

### 5.2 Fallback rule

When rendering for locale `L`: use `translations[L].name` if present and
non-null, otherwise fall back to the canonical `name`. Same rule for
`short_description`. This fallback is **always available** because `name`
is required and non-nullable — a venue can never render with no name in any
locale, even a locale with zero translation coverage.

### 5.3 Sorting

**Sorting always uses the canonical `name` column, never a translated
value**, in every context (`GET /editor/venues`, the publish snapshot's
`ORDER BY destination.name` / `venue.name`, per the prior spec's publish
engine). This avoids locale-dependent collation ambiguity (Arabic and Latin
sort orders are not comparable) and keeps ordering stable regardless of
which locale a given client is rendering for.

### 5.4 Search

`q` matches only against canonical `name` in v1 — **translated fields are
explicitly out of scope for search in this version.** Documented trigger
for revisiting: "when a real requirement for searching non-English content
appears, extend the trigram index (§3.2) to also cover
`translations->>'ar'->>'name'`, or a locale-appropriate equivalent — no
schema change is required to do so, since `translations` is already JSONB."

### 5.5 Future expansion

Adding a third (or tenth) locale requires **zero schema migration** — it is
a new key in an already-existing JSONB column. This is the specific property
that closes the review's concern about "the second migration event Principle
1.7 was written to prevent, just for a different entity" — no migration
event is needed at all for locale growth, by construction.

### 5.6 Migration mapping

Legacy Arabic venue names (evidenced in the audited export, e.g.
`أبراج العلمين الجديدة`) are migrated into `translations.ar.name`
**wherever the legacy `name` field's value is not ASCII** — a mechanical,
unambiguous rule requiring no per-record judgment. The canonical `name`
column receives the same legacy value in that case (i.e., a venue whose only
recorded name is Arabic has `name` = that Arabic string *and*
`translations.ar.name` = the same string, satisfying both "name is always
populated" and "the Arabic value is also explicitly available via the
translations API surface for a future locale-aware client").

### 5.7 Why this is now closed

A concrete column, shape, fallback rule, sort rule, search boundary, and
migration mapping are all specified — including the exact rule for the
already-evidenced Arabic data, not just a promise to "handle it later." No
future decision is deferred; only future *locale additions* are deferred,
and those are explicitly zero-migration by design.

---

## 6. API Versioning

> **Review finding (§4.1, High):** *"§12 states 'No API redesign' is
> permanent, yet nowhere does the API have a version marker... A
> specification that freezes its API surface while providing no mechanism to
> introduce a v2... has frozen itself into a corner."*

**Accepted.**

### 6.1 The policy

**URI versioning.** The entire current, unversioned API surface (every
`/editor/*`, `/public/*`, `/health` route in the prior spec's §8) is hereby
**declared to be v1**, retroactively and without any path change — no
client, existing or future, needs to change anything as a result of this
section. This is possible precisely because URI versioning's cost is paid
only when a v2 is actually introduced, not before.

### 6.2 Rule for the current surface (v1)

Within v1, only **additive, backward-compatible** changes are permitted
without a version bump:
- New optional request fields.
- New response fields (clients must be written to ignore unknown fields —
  already true of any reasonable JSON client, stated here so it's an
  explicit contract, not an assumption).
- New endpoints.
- New optional query parameters.

**Never permitted within v1**, under any circumstance, including a "bug fix"
framing: removing a field, renaming a field, changing a field's type,
changing a status code's meaning for an existing case, or changing an
endpoint's URL. Any of these is a breaking change and requires §6.3.

### 6.3 Introducing a v2 (future, not built now)

If a genuinely breaking change is ever required: it is introduced under a
new path prefix (`/v2/editor/...`, `/v2/public/...`), while every existing
`/editor/*`/`/public/*` route **continues to serve unchanged v1 semantics**
for the duration of the deprecation window below. This is the concrete
mechanism the review's finding said was missing — it costs nothing today
(no code changes now) and removes the "frozen into a corner" risk entirely,
because the escape hatch is named and ready rather than invented
under pressure later.

### 6.4 Deprecation policy

Once a v2 route exists for a given resource: the corresponding v1 route
remains fully functional for a minimum of **6 months**, during which its
responses carry `Deprecation: true` and `Sunset: <date>` HTTP headers (both
standard, both purely additive — no existing client that doesn't read these
headers is affected). After the sunset date, the v1 route may be removed —
itself a Specification Amendment, not a silent removal.

### 6.5 Why this is now closed

The policy is named (URI versioning, not header/content-negotiation
versioning — a single, unambiguous choice), the current surface is given an
explicit version identity at zero migration cost, the backward-compatibility
boundary within a version is defined precisely enough to be checked against
a real PR, and the deprecation window has a stated minimum duration rather
than "eventually." Nothing here requires implementation now — it requires
exactly what the review asked for: that the *policy* exist before the *need*
does.

---

## 7. All remaining review findings, resolved

Every finding from `PLATFORM_SPEC_REVIEW.md` not already covered in §1–6.

---

### 7.1 Broken internal cross-references

> **§1.1, Critical:** *"§0 cites `§0.3` and `§0.1` twice... Neither citation
> resolves to anything."*

**Accepted.** This document does not repeat the error: every cross-reference
in this document points to a section that actually exists in this document
(verified in §8.2 below). The prior spec's §0 is superseded in full by this
document, so the broken citations no longer exist anywhere in the
authoritative record. **Closed by supersession**, not by patching the old
document.

---

### 7.2 Destination deletion has two contradictory mechanisms

> **§1.2, High:** *"`DELETE /editor/destinations/{id}`... vs.
> `status='archived'`... The spec never states which one an editor should
> use... nor what happens to the other."*

**Accepted.**

**Decision:** `DELETE /editor/destinations/{id}` is retained, but its scope
is narrowed and stated explicitly for the first time: **it is an
admin-only, permanent-removal operation for a destination that has zero
associated venues** (already true structurally — the existing
`ON DELETE RESTRICT` foreign key makes any other case fail at the database
level — this section makes that behavior a stated part of the contract
rather than an accidental side effect a caller discovers by trial). It exists
specifically for "a destination created in error, before any venue was ever
attached to it." **`archived` status is the only mechanism for removing a
destination that has real content under it**, and it is reversible
(`archived → draft`, per the workflow in the prior spec's §4.2, unchanged).

**Spec update:** §7 (Destination Model) of the prior spec gains this
sentence, verbatim, as its final word on the topic: *"`DELETE` is a
correction tool for an empty, mistakenly-created destination; `archived` is
the only removal path for a destination with any real content, and it is the
one that is reversible."*

**Why closed:** the two mechanisms no longer answer the same question — one
is "undo a mistake with nothing built on it yet," the other is "retire real
content." No overlap remains.

---

### 7.3 `region` is a closed vocabulary with no enforcement

> **§3.1, Medium:** *"the schema gives it no CHECK constraint, unlike
> category and status... Nothing... prevents region from suffering the
> identical fate [as the legacy `destination` field drift]."*

**Accepted.**

**Decision:** `region` becomes a `CHECK`-constrained column, same treatment
as `category`, with the actual known value set fixed at exactly the values
already in production/audited use: `Sidi Abdelrahman Area`, `Marina`,
`New Alamein City`, `Telal North Coast`, `Ras El Hekma`, `Fouka Bay`,
`Dabaa City`, `Almaza Bay` (8 values — the 6 audit-inferable ones plus the 2
already confirmed in production/the export's naming). Any of the 24
destinations whose region cannot be confidently assigned one of these 8 at
migration time is held out of that migration run and reported by name,
identically in spirit to §2.3's beach-exclusion rule — **never
force-assigned a guessed value.**

**Spec update:** §7.2 of the prior spec is amended from "not a table, ~5-8
known values" (a description with no enforcement) to "an 8-value `CHECK`
constraint, listed above, with the same promote-to-table trigger condition
already stated for `category` (§3.4 of the prior spec: >20 values, or
per-value metadata becomes a real requirement)."

**Why closed:** the same class of drift the audit found in
`venues.destination` is now structurally prevented in `region`, and the
constraint list closes the "not the same treatment as category despite
being described in identical terms" inconsistency the review identified.

---

### 7.4 No rejection-reason capture

> **§3.2, Medium:** *"a reject with no recorded reason means the submitting
> editor has no way to learn what to fix."*

**Accepted.**

**Decision:** `POST /editor/venues/{id}/reject` (and its destination
equivalent) **requires** a non-blank `reason` string in its request body,
logged to `activity_log.metadata` (`{"reason": "..."}`) alongside the
existing `action`/`entity_type`/`entity_id`/`actor` fields — no new column,
no new table.

**Spec update:** §4.2 of the prior spec's `review → draft` (Reject) row
gains a validation gate: *"reason (non-blank string) required."*

**Why closed:** the mechanism already exists (`activity_log.metadata` is
already a JSONB field used for exactly this kind of structured, per-action
detail); this is a requirement to populate it, not a schema change.

---

### 7.5 No ownership/assignment concept

> **§3.3, Low:** *"flagged only because... editorial workflow explicitly
> asks about ownership."*

**Accepted as a documented, deliberate deferral — not built.**

**Decision:** ownership/assignment is explicitly out of scope for v1.
**Spec update:** added to the "Future" tier (§9.3 of the prior spec) with
the trigger condition stated: *"revisit if simultaneous-editor contention
(§4 of this document) proves insufficient on its own to prevent real
confusion about who is working on what."*

**Why closed:** not because it's solved, but because it is now a named,
intentional deferral with a stated trigger — exactly what Principle 1.6
requires, rather than a silent omission.

---

### 7.6 Two bulk-update endpoints that should be one

> **§4.2 / §9.1, Low:** *"structurally identical — a venue-id list plus one
> field to set."*

**Accepted.**

**Decision:** `PATCH /editor/venues/bulk/category` and `PATCH
/editor/venues/bulk/destination` are unified into one endpoint: `PATCH
/editor/venues/bulk` accepting `{"venue_ids": [...], "patch": {"category":
string?, "destination_id": string?}}`, validated so that a single call may
update either or both fields in one pass.

**Spec update:** §8.2 of the prior spec's two rows are replaced by this one
entry.

**Why closed:** one endpoint, one schema, no capability lost — a pure
simplification with no open question remaining.

---

### 7.7 `bulk` as a reserved path segment

> **§4.3, Low:** *"a venue whose id happened to be literally `bulk` would be
> unreachable... the spec never states the constraint."*

**Accepted.**

**Decision:** venue and destination ids must never equal a reserved
segment: `bulk`, `export`, `duplicates`, `stats`. This is enforced the same
way slug uniqueness already is — at venue/destination creation time
(`POST /editor/venues`, `POST /editor/destinations`), rejecting a reserved
value with `422`.

**Spec update:** one sentence added to §7 (Destination Model) and the venue
equivalent in §2.2 of the prior spec.

**Why closed:** the theoretical collision is now a stated, enforced
constraint rather than an unstated assumption.

---

### 7.8 `beach_details` shape validated only at the application layer

> **§5.2, Medium:** *"any future direct-model write that bypasses the
> validation function... has no database-level backstop."*

**Accepted.**

**Decision:** a `CHECK` constraint is added to `venues`:
`beach_details IS NULL OR (category = 'Beach' AND beach_details ?
'type' AND beach_details ? 'publicAccess')` — a structural (keys-present)
check, not a full shape/type validator (Postgres `CHECK` on JSONB is
practical for key-presence, not for deep type validation of nested values;
deep validation remains the application layer's job, unchanged).

**Spec update:** §2.2 (Venue) of the prior spec's `beach_details` row gains
"DB-enforced key presence; value-shape validation remains application-layer,
per the same practical limit that already applies to `opening_hours`."

**Why closed:** the same category of invariant (`category`, `status`) that
gets DB enforcement elsewhere now gets it here too, closing the specific
inconsistency the review named, within the real limits of what a JSONB
`CHECK` constraint can practically enforce.

---

### 7.9 `PublishRevision.destination_count`/`venue_count` are redundant

> **§5.3 / §9.2, Low:** *"the same snapshot row already contains the full
> arrays... `len(snapshot['venues'])` is computable from data already
> present in the same row."*

**Accepted.**

**Decision:** both columns are removed. Revision-list counts are computed as
`jsonb_array_length(snapshot->'venues')` / `->'destinations'` at read time —
zero additional query cost, since the row housing `snapshot` is already
fetched for the revision list.

**Spec update:** §2.5 of the prior spec's table drops both rows entirely.

**Why closed:** a pure simplification; no information is lost, no query
gains a join, and Principle 1.4's "computed, not stored" standard is now
applied consistently rather than carved out as an exception for this one
case.

---

### 7.10 Approve-time re-validation failure has no specified outcome

> **§6.1, Medium:** *"Does the row stay in review with an error surfaced?
> Does it snap back to draft?... Nothing in this document specifies."*

**Accepted.**

**Decision:** if re-validation fails at Approve time (including the new
`destination_not_approved` case from §1.2 of this document), the call is
rejected with `422`, and the **row remains in `review`** — it is never
silently promoted, and it is never silently demoted back to `draft` (that
would discard the submission without the submitter's knowledge). The
approver sees the validation errors (reusing the existing `ValidationResult`
shape, unchanged) and either fixes the row themselves, or Rejects it with a
reason (§7.4 above) so the original editor can.

**Spec update:** §4.2 of the prior spec's `review → approved` row gains:
*"On re-validation failure: 422, row remains in `review`, errors returned in
the same `ValidationResult` shape Validate already uses."*

**Why closed:** the one genuinely under-specified transition in the
workflow now has a stated, unambiguous outcome.

---

### 7.11 No SLA/staleness signal for rows stuck in review

> **§6.2, Low:** correctly noted as "not a defect... correctly out of scope
> for v1."

**Accepted, no change required.** The review itself classified this as
out-of-scope-for-v1, not a gap needing closure. Confirmed here, unchanged,
so it's recorded as consciously considered rather than silently absent.

---

### 7.12 Save Draft is unlogged — auditability blind spot

> **§7.1, Medium:** *"there is no way to reconstruct what changed between
> two edits, or who made a specific factual change that later needed
> correcting."*

**Accepted, with a scoped fix — not full field-level history.**

**Decision:** every `PATCH /editor/venues/{id}` and `PATCH
/editor/destinations/{id}` call now logs to `activity_log`
(`action: "draft_updated"`, `metadata: {"fields_changed": [...]}` — the
*names* of the fields that changed, not their before/after values, keeping
this lightweight rather than building a full audit-diff system). This closes
"who changed what and when" at the field-name level, which is sufficient to
answer "did someone touch the phone number between these two dates" without
building a value-level history table.

**Spec update:** a new row in §2.9 (Statistics)'s sibling concern — actually
in §4 (Workflow) of the prior spec, a new sentence: *"Every Save Draft call
is logged to `activity_log` with the changed field names; full before/after
value history remains out of scope for v1."*

**Why closed:** the specific gap named (no reconstruction of "what changed,
by whom, when" at all) is closed; a stronger version (value-level diffing)
is named as a conscious, bounded deferral rather than conflated with the
gap actually being fixed.

---

### 7.13 `legacy_geo` has no expiry or cleanup trigger

> **§8 (Long-term maintenance):** *"the spec never states when, if ever, it
> can be dropped... likely to become 'that column nobody remembers the
> reason for.'"*

**Accepted.**

**Decision:** `legacy_geo` may be dropped via a routine schema migration
(not a Specification Amendment — this is explicitly pre-authorized) once
**both** of the following hold: (a) the migration (§2 of this document) has
been running in production, verified stable, for at least 90 days, and (b)
no feature built on top of `legacy_geo`'s data has shipped in that window
(if one has, the column has become load-bearing and this pre-authorization
no longer applies — that case *would* need an Amendment).

**Spec update:** §2.2 (Venue) of the prior spec's `legacy_geo` row gains:
"Drop-eligible per the condition stated in §7.13 of the Frozen spec — this
is the one column in this schema pre-authorized for removal without a full
Amendment."

**Why closed:** the column now has a stated expiry condition instead of
permanent, unexamined residency in the hot table.

---

### 7.14 Multiple countries — implicit single-country assumption

> **§2.4, Medium:** *"the entire schema implicitly assumes a single country
> ... this one isn't written down anywhere."*

**Accepted.**

**Decision:** stated explicitly, as the review requested, with no schema
change: **this schema assumes a single country (Egypt).**
Multi-country support is out of scope for v1 and would require a `country`
column on `destinations` — not added now, since no near-term requirement
exists, but named here so the assumption is explicit rather than inferred
from an absence.

**Spec update:** one sentence added to §7 (Destination Model) of the prior
spec, verbatim as above.

**Why closed:** the assumption is now written down, satisfying Principle
1.5 without adding any unneeded schema.

---

## 8. Freeze Verification

### 8.1 All contradictions resolved
- Beach migration-sequencing vs. write-path requirement (prior spec's §0):
  resolved definitively in §2 of this document — canonical identity,
  complete field mapping, mandatory write path, all stated, none deferred.
- Destination `DELETE` vs. `archived` (§7.2 above): scoped so the two no
  longer overlap.
- Referential closure gap (§1 above): closed with a stated invariant,
  two-layer enforcement, and defined failure behavior.

### 8.2 No unresolved TODOs or dangling cross-references
Every `§N` reference in this document points to a section that exists within
this document. No reference to a "future runbook," "to be decided later," or
equivalent phrasing remains anywhere in §1–§7 — every finding above ends in
a stated decision, not a deferred one (deferrals that *are* intentional —
§7.5 ownership, §7.11 SLA signals, i18n locale growth in §5.5 — are each
explicitly labeled as deliberate deferrals with a trigger condition, which
is the standard this document holds itself to, not an exception to it).

### 8.3 Every entity has a complete specification
`Destination`, `Venue`, `Beach` (as a venue subtype, §2), `Category`,
`PublishRevision`, `User`, `Media` (as columns, not a table), `Review` (as a
workflow state), `Statistics` (as computed values) — every entity named in
the original specification task retains its full field-by-field
specification from `PLATFORM_SPEC_v1_FINAL.md` §2, amended only where this
document's §1–§7 explicitly change a field (`version` added to `venues`/
`destinations` in §4; `translations` added to both in §5; `region`
CHECK-constrained in §7.3; `destination_count`/`venue_count` removed from
`PublishRevision` in §7.9). No entity is left with an open question.

### 8.4 Every workflow is complete
The `draft → review → approved → (published) → archived` state machine
(prior spec §4) now has a stated outcome for every transition, including the
two the review found missing: Approve's re-validation failure (§7.10) and
Reject's reason requirement (§7.4). The referential-closure rule (§1)
integrates into Approve without changing the state machine's shape — it
adds a gate condition, not a new state.

### 8.5 Migration can now proceed without changing this specification
Every question §10 of the prior spec (Migration Specification) depended on
an unresolved answer for is now answered concretely in this document:
- Beach identity, field mapping, and exclusion list: §2.2–2.3.
- Region value assignment and exclusion handling: §7.3.
- Referential-closure implications for migrated `draft` rows: none — §1's
  gate only applies at Approve/Publish time, and migrated rows land as
  `draft` (prior spec §10.4, unchanged), so migration itself never triggers
  the closure check at all. Worth stating explicitly: **migration produces
  no snapshot inclusion risk, because nothing it imports is ever
  `approved` as a side effect of import.**

No open question remains that would require this document to be revised
once migration begins.

---

## 9. Verdict

> ### **APPROVED FOR IMPLEMENTATION**

This document supersedes every previous specification in this repository.

**From this point forward:**
- Only bug fixes may change this document — a bug fix corrects an
  implementation that fails to match what is written here; it never changes
  what is written here.
- Any future architectural change — including any change to §1–§7's
  decisions, even ones that later prove inconvenient — requires a formal
  Specification Amendment: the specific section in conflict, why the frozen
  decision cannot be satisfied as written, and a narrowly-scoped proposed
  change, appended to this document with a dated changelog entry, never
  edited in place.
- The one pre-authorized exception is §7.13's `legacy_geo` drop condition,
  which may proceed as a routine migration once its stated condition is met
  — explicitly not requiring a full Amendment, because that possibility was
  itself decided and recorded here, now, rather than left open.

*No code was written. No schema was created. No migration was written. No
SQL was executed. This document is the specification an implementation must
now be built against.*
