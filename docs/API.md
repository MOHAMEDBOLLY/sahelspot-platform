# API

## Status

Backend stack is **finalized**: Python 3.12 (currently running on 3.13 locally, see [`ARCHITECTURE.md`](ARCHITECTURE.md#known-deviations)), FastAPI, SQLAlchemy 2, Alembic. App startup, config, logging, and a Supabase/PostgreSQL connection have existed since Sprint 1. The data model (Sprint 3) and read endpoints for destinations and venues (Sprint 4, enriched Sprint 8) exist and are verified against a real Supabase database. Sprint 11 added the first write endpoint, `PATCH /venues/{venue_id}` (Save Draft) — no validation, no status transition. Sprint 12 adds the "Validate" gate itself: `POST /venues/{venue_id}/validate`, a read-only canonical check the frontend cannot bypass or duplicate. Sprint 13 evolves that same endpoint's response into an **Editorial Readiness** model (`valid`, `ready_for_review`, `errors`, `warnings`, `info`). Sprint 14 adds the first editorial state transition: `POST /venues/{venue_id}/submit-for-review` moves a venue from `draft` to `review`, gated on `ready_for_review`. Sprint 15 adds the second: `POST /venues/{venue_id}/approve` moves `review` to `approved`, sharing a centralized transition guard (`app/workflow/transitions.py`) with Review rather than duplicating the status-check logic. Sprint 16 adds the Publish Engine: `POST /publish` freezes every currently `approved` destination/venue into a new immutable `publish_revisions` snapshot, and `GET /published/venues` is the first public read path — it reads *only* that snapshot, never the draft tables. Sprint 17 adds the read-only Revision Browser: `GET /publish/revisions` (history list) and `GET /publish/revisions/{id}` (a single revision's metadata plus its full snapshot) — both metadata/inspection only, neither writes anything. Sprint 18 adds Republish: `POST /publish/revisions/{id}/republish` moves the current-revision pointer to an existing revision — no new snapshot, no data regenerated, only the same atomic pointer-flip `publish()` already used.

## Stack

- **Python 3.12**
- **FastAPI** — web framework serving the API.
- **SQLAlchemy 2** — ORM / database toolkit.
- **Alembic** — database migrations. Initialized as of Sprint 3; the first migration (`0001_initial_schema`) is applied and verified against a real Supabase database.
- **Database**: Supabase (PostgreSQL) — see [`DATABASE.md`](DATABASE.md).

Interactive docs (Swagger UI) are available at `/docs`, ReDoc at `/redoc`, generated automatically by FastAPI.

## Endpoints

### `GET /`

Returns API name and version. Added Sprint 1.

```json
{
  "name": "SahelSpot API",
  "version": "0.1.0"
}
```

### `GET /health`

Returns database connectivity status. Added Sprint 1.

```json
{
  "status": "ok",
  "database": "connected"
}
```

If the database is unreachable, returns `503` with:

```json
{
  "detail": {
    "status": "error",
    "database": "disconnected"
  }
}
```

### `GET /destinations`

Returns all destinations. Added Sprint 4, unchanged since.

### `GET /venues`

Returns all venues. Added Sprint 4; response model enriched Sprint 8 (see below).

### `GET /venues/{venue_id}`

Returns a single venue, or `404`. Added Sprint 4; response model enriched Sprint 8 (see below).

### `PATCH /venues/{venue_id}`

Added Sprint 11 — **Save Draft**, the first write endpoint. Updates the draft `venues` row in place and returns the updated venue (`VenueOut`, same shape as the `GET` endpoints). `404` if the venue doesn't exist.

This is not Publish: it never touches `status` or `publish_revisions`, and the row's `updated_at` changes but its editorial `status` does not. There is no request-body validation beyond Pydantic's own type coercion — the "Validate" workflow step (required fields, category/coordinate sanity checks) is a deliberately separate, not-yet-built gate between `draft` and `review` (see [`DATABASE.md`](DATABASE.md#editorial-status-one-shared-vocabulary-renamed-to-avoid-colliding-with-the-new-meaning-of-publish)), not something this endpoint enforces.

Request body (`VenueUpdate`) accepts a subset of `VenueOut`'s fields — exactly the ones the Studio's Edit Mode currently exposes as editable:

```json
{
  "name": "The Smokery",
  "category": "Restaurant",
  "district": "Marina",
  "is_featured": true,
  "is_verified": true,
  "short_description": "...",
  "latitude": "30.821785",
  "longitude": "28.977455",
  "maps_url": "...",
  "phone": "...",
  "whatsapp": "...",
  "website": "...",
  "instagram_handle": "...",
  "facebook_handle": "...",
  "tiktok_handle": "...",
  "internal_notes": "..."
}
```

All fields are optional (partial update — only keys present in the body are written, via `.model_dump(exclude_unset=True)`). Fields the Studio doesn't yet expose as editable (`id`, `slug`, `destination`, `status`, `opening_hours`, `beach_details`, `cover_image_url`, `gallery_image_urls`, `source`, timestamps) aren't part of this schema at all — sending them is simply ignored, not rejected, since `VenueUpdate` doesn't declare them.

Deliberately unchanged in Sprint 12: this endpoint still performs no business-rule validation — Save Draft can persist an incomplete or out-of-range venue, by design (see below).

### `POST /venues/{venue_id}/validate`

Added Sprint 12 as the **Validate** gate described in [`DATABASE.md`](DATABASE.md#editorial-status-one-shared-vocabulary-renamed-to-avoid-colliding-with-the-new-meaning-of-publish); as of Sprint 13, its response is framed as an **Editorial Readiness** check — see [Editorial Readiness](#editorial-readiness-sprint-13) below for why that's a distinct concept from Review itself. Endpoint and request/response shape are unchanged from Sprint 12 in every way except the response body growing new fields — same route, same "no body, checks the persisted row" semantics, same `404` on an unknown id.

Runs against the venue's **currently persisted** row, not a request body — there's nothing to submit, since it checks what's already saved (run Save Draft first if there are unsaved edits).

Response (`ValidationResult`, from `app/validation/schemas.py` — a shape meant to be reused by every future entity's readiness check, not just venues):

```json
{
  "valid": false,
  "ready_for_review": false,
  "errors": [
    { "field": "latitude", "message": "Latitude must be between 30.6 and 31.1." }
  ],
  "warnings": [],
  "info": []
}
```

- `errors` — unchanged from Sprint 12: the canonical business rules, and the only place they're enforced:
  - `name` non-blank.
  - `category` one of the documented `VENUE_CATEGORIES` (already DB-enforced by a `CHECK` constraint at write time, but re-checked here too so a bad value produces this structured response instead of a raw constraint-violation error).
  - `latitude`/`longitude`, when present, within the observed North Coast range (`[30.6, 31.1]` / `[28.6, 29.4]`) — a sanity bound per `DATABASE.md`, not a DB constraint, which is exactly why it's enforced in application code rather than a `CHECK`.
- `valid` — `true` iff `errors` is empty. Unchanged meaning from Sprint 12.
- `ready_for_review` — as of Sprint 13, derived from `errors`/`warnings` by a single shared function, `build_validation_result()` (`app/validation/schemas.py`), rather than duplicated per entity. Currently identical to `valid` (no warning yet blocks readiness — deliberately, per this sprint's "don't invent business rules" instruction), but it's the field Review will actually consume later, not `valid` — see below.
- `warnings` / `info` — new, additive extension points. Always empty today; no rule produces them yet. Same `FieldError {field, message}` shape as `errors`. Once a real warning-producing rule exists (e.g. "no cover image set" — informational, not blocking), it appends here without touching `errors` or the response shape.

The frontend's Edit Mode runs its own lightweight checks (required-ness, character limits, URL/number format) for instant typing feedback and to gate the Save Draft button — see `datalab-next/src/lib/validation.ts` and `features/venues/venueValidation.ts`. Those are UX conveniences only; they never re-implement the rules above, and the backend never trusts them — every rule that decides whether a venue is actually fit to publish is checked here and only here.

#### Editorial Readiness (Sprint 13)

**Why Editorial Readiness is separate from Review.** Review (not yet built) is a *stateful transition*: a human decision that moves `venues.status` from `draft` to `review`, recorded in the database. Editorial Readiness is a *stateless question*: "if someone tried to move this row into Review right now, would it qualify?" Keeping them separate means a user (or a future automated check) can ask that question as many times as they want, at any point, with zero side effects — exactly what `POST /venues/{id}/validate` already does. Collapsing them into one endpoint would mean either every readiness check risks mutating `status` (dangerous — validation should never be a side-effecting action) or Review would need its own separate validation logic (duplicating the rules in `validate_venue()`). Keeping Editorial Readiness as its own concept means Review, whenever it's built, can *require* `ready_for_review: true` as a precondition without owning any of the rule logic itself.

**How Review will later consume this state.** Review's implementation (not yet built) is expected to call this same endpoint's underlying `validate_venue()` (or the HTTP endpoint itself) as a precondition check before allowing the `draft → review` transition — reject the transition with a 4xx and the same `errors` list if `ready_for_review` is `false`, proceed if `true`. No new validation logic gets written for Review; it consumes the existing `ValidationResult`, which is the entire reason this sprint extended the response shape instead of building a parallel one.

**How Publish will later depend on Review.** Per [`DATABASE.md`](DATABASE.md#editorial-status-one-shared-vocabulary-renamed-to-avoid-colliding-with-the-new-meaning-of-publish), only rows with `status = approved` are eligible for the next Publish snapshot, and `approved` is only reachable by passing through `review` first (`draft → review → approved`). So Publish's eventual eligibility check is transitively gated by this sprint's work: a row can't be `approved` without having passed Review, and Review (once built) won't allow the transition without `ready_for_review: true` from this endpoint. Editorial Readiness is therefore the first link in that chain, not a parallel or optional one.

### `POST /venues/{venue_id}/submit-for-review`

Added Sprint 14 — **Review**, the first editorial state transition: `venues.status` moves from `draft` to `review`. Takes no request body — like Validate, it acts on the venue's currently persisted row. Returns the updated venue (`VenueOut`, same shape as the `GET`/`PATCH` endpoints) on success. `404` if the venue doesn't exist.

Rejects rather than silently no-oping on an invalid transition, with a structured `detail`:

- **`409 Conflict`** if the venue's current `status` isn't `draft` (covers "already in review," "already approved," and "archived" alike — anything that isn't `draft` is rejected the same way):
  ```json
  {
    "detail": {
      "error": "invalid_transition",
      "message": "Venue is in 'review' status; only a 'draft' venue can be submitted for review.",
      "current_status": "review"
    }
  }
  ```
- **`422 Unprocessable Entity`** if the venue *is* `draft` but isn't ready — `validate_venue()`'s `ready_for_review` is `false`:
  ```json
  {
    "detail": {
      "error": "not_ready_for_review",
      "message": "Venue is not ready for review.",
      "errors": [
        { "field": "latitude", "message": "Latitude must be between 30.6 and 31.1." }
      ]
    }
  }
  ```

**This is an editorial action, not a validation check — the two stay separate on purpose.** The route calls `validate_venue()` (the exact same function `POST /venues/{id}/validate` calls) as a precondition, rather than re-implementing readiness logic or trusting a client-supplied "yes it's ready" flag. Validate itself remains read-only and side-effect-free; this endpoint is the only place in the codebase that writes `venues.status`. Nothing here touches `publish_revisions` — `review` is not a publishable state, and Approval (the still-unbuilt `review → approved` transition) is a separate, later action, not something this endpoint does implicitly on top of the `draft → review` move.

#### Review Workflow (Sprint 14)

**Why Review is the first workflow transition.** Of the four state changes `venues.status` will ever make (`draft → review → approved`, then the separate `archived` path), `draft → review` is the only one with no precondition beyond Editorial Readiness itself — Sprint 13 already built the exact check (`ready_for_review`) this transition needs, with nothing else to design first. `review → approved` (Approval) implies a human reviewer's decision the schema doesn't model yet (who approved it, when, any reviewer notes), and `approved →` Publish is a whole-dataset snapshot operation (see [`DATABASE.md`](DATABASE.md#publish_revisions)), not a single-row transition at all. Building `draft → review` first means every later transition can follow the same shape it establishes here — fetch the row, check a precondition, reject with a structured error or write the new `status` — rather than inventing that pattern from scratch once the harder transitions (which need actual new business rules) are in scope.

**Why Approval remains separate.** Folding `review → approved` into this same endpoint (e.g., an optional "and approve it too" flag) would collapse two different real-world decisions into one action: "is this row objectively ready" (Editorial Readiness, already automatable) versus "does a human reviewer actually approve this content" (Approval — a judgment call, not a re-run of the same checks). The moment Approval is scoped, it'll need its own precondition (status must be `review`, not `draft`) and very likely its own actor/notes fields once authentication exists — none of which belongs bolted onto Review's endpoint. Keeping them as two distinct, later-composable actions (`draft → review` now, `review → approved` next) mirrors exactly how `DATABASE.md` already describes the workflow as four distinct stages, not two.

### `POST /venues/{venue_id}/approve`

Added Sprint 15 — **Approval**, the second editorial state transition: `venues.status` moves from `review` to `approved`. Same shape as Review's endpoint: no request body, acts on the persisted row, returns the updated venue (`VenueOut`) on success, `404` if the venue doesn't exist.

- **`409 Conflict`** if the venue's current `status` isn't `review` (covers `draft`, already-`approved`, and `archived` alike):
  ```json
  {
    "detail": {
      "error": "invalid_transition",
      "message": "Venue is in 'draft' status; only a 'review' venue can move to 'approved'.",
      "current_status": "draft"
    }
  }
  ```
- No `422` here, unlike Review — Approval has no automatable readiness gate of its own. Editorial Readiness was already the prerequisite for entering `review` in the first place; Approval doesn't run `validate_venue()` again, because re-validating would imply the two are the same kind of check when they aren't (see [Why Validation never changes workflow state](#why-validation-never-changes-workflow-state) below).

**Centralized transition logic.** Both this endpoint and `submit-for-review` now share `require_status()` (`api/app/workflow/transitions.py`, a new package) — the one function that checks `venue.status` against what a transition expects and raises the structured `409` above if it doesn't match. Neither endpoint hand-rolls its own status guard; the 409 shape exists in exactly one place, and any future transition (e.g., an eventual Archive action) calls the same function rather than re-typing the check.

#### Approval Workflow (Sprint 15)

**Why Approval is a separate editorial decision.** Editorial Readiness (Sprint 13) answers an objective, automatable question: does this row satisfy the documented rules (required fields, category, coordinate bounds)? Approval answers a subjective one: does a human reviewer actually sign off on this content being ready to go live? A venue can be perfectly "ready" by every mechanical check and still get held back at Approval for reasons no validation rule could express (wrong tone, a stale photo, a business that's since closed) — and conversely, nothing about passing Editorial Readiness implies anyone has actually looked at the content. Treating Approval as a re-run of Validate would conflate these two fundamentally different kinds of judgment; instead, Approval's only enforced precondition is the state guard (`status == 'review'`), never a repeat of `validate_venue()`.

**Why Publish will depend on Approval.** Per [`DATABASE.md`](DATABASE.md#publishing-model), Publish gathers every row with `status = approved` and freezes them into a new `publish_revisions` snapshot — `approved` is the *only* status Publish ever looks at. Since `approved` is reachable only via this endpoint, and this endpoint only accepts a venue already in `review` (itself only reachable after Editorial Readiness passed), Publish's eventual eligibility set is transitively the set of venues a human has both validated-as-ready *and* explicitly approved. Publish will not re-check readiness or re-decide approval; it will simply trust that `status = approved` already means both happened, in order — which is exactly why both gates have to be real, separate, database-recorded steps rather than something Publish infers by re-running checks itself.

**Why Validation never changes workflow state.** `POST /venues/{id}/validate` (Sprint 12/13) is deliberately read-only and side-effect-free — it has never written `venues.status`, not before Review existed and not now that Approval exists too. Both of the actual status-writing actions (`submit-for-review`, `approve`) *call into* `validate_venue()` or its result as a precondition where relevant (Review does; Approval doesn't, per above), but the validation function itself has no awareness of `status` at all — it only inspects field values. This means Editorial Readiness can be checked as many times as anyone wants, at any point in a venue's lifecycle, without any risk of accidentally advancing it through the workflow — the only two places `status` ever changes are `submit_venue_for_review` and `approve_venue`, both in `api/app/api/routes/venues.py`, both now built on the same shared `require_status()` guard.

## Response model enrichment (Sprint 8)

The frontend is meant to receive presentation-ready data — it shouldn't have to resolve an id into a name, or otherwise derive a display value from raw fields. `venues.destination_id` (a foreign key, e.g. `"marassi"`) forced exactly that: the Studio UI was displaying the raw id in place of a destination name.

**Changed**: `VenueOut.destination_id: str` → `VenueOut.destination: DestinationRef`, where `DestinationRef` is `{id: str, name: str}`. Both `GET /venues` and `GET /venues/{id}` now return:

```json
{
  "destination": {
    "id": "marassi",
    "name": "Marassi"
  }
}
```

instead of `"destination_id": "marassi"`. The FK column itself is unchanged (see [`DATABASE.md`](DATABASE.md)) — this is a read-model change only: the route now eager-loads the related `Destination` row (`joinedload(Venue.destination)`, one query, not N+1) and the response schema nests it. No migration, no new table — a SQLAlchemy `relationship()` was added to the existing `Venue`/`Destination` models to make the eager-load possible, which is an ORM-level mapping, not a schema change.

`DestinationRef` is deliberately a lean `{id, name}`, not the full `DestinationOut` — a venue list doesn't need every destination field (region, status, boundary, ...) repeated per row; that's what `GET /destinations` is for.

**Considered and left alone**: `category`, `district`, and `status` are already plain, human-readable strings with no lookup table behind them (a deliberate simplification from the Sprint 2.5 schema review — see [`DATABASE.md`](DATABASE.md#categories-a-small-fixed-flat-list--not-a-table)), so there's no id to resolve. Booleans (`is_featured`, `is_verified`) and timestamps are left as raw booleans/ISO strings — formatting those into "Yes"/"No" or a locale-specific date is display formatting, not business logic, and doing it server-side would bake in a language/timezone the API has no business assuming.

### `POST /publish`

Added Sprint 16 — the **Publish Engine**. Gathers every `destinations`/`venues` row currently `status = approved`, freezes them into a new, immutable `publish_revisions` row, and atomically makes it the current one (the previous current revision, if any, is flipped to `is_current = false` in the same transaction — never edited, never deleted). No request body. Returns `PublishRevisionOut` — revision metadata, not the full snapshot:

```json
{
  "id": 3,
  "is_current": true,
  "published_at": "2026-07-24T17:54:00.356000Z",
  "published_by": null,
  "label": null,
  "destination_count": 1,
  "venue_count": 1
}
```

Also stamps `last_published_at` on every published `destinations`/`venues` row (the field `docs/DATABASE.md` already designed for exactly this, unused until now) — the same timestamp as the revision's own `published_at`, so "was this row included in the current publish" and "when was the current publish" always agree.

**Not a status change.** This route never reads or writes `destinations.status`/`venues.status` — Approval (Sprint 15) already decided what's eligible; Publish only freezes it. The engine itself (`app/publishing/engine.py`) has no concept of `draft`/`review` at all, only "is this row `approved` right now."

### `GET /published/venues`

Added Sprint 16 — the first real **public read path**. Reads *only* the current publish revision's frozen snapshot — there is no code path in this handler that queries the draft `venues`/`destinations` tables at all, so draft, in-review, or approved-but-not-yet-published content can never appear here, by construction rather than by a filter that could be forgotten. Returns `[]` if nothing has ever been published. Response shape (`PublishedVenueOut`) is deliberately leaner than `VenueOut`: no `status` (everything here is implicitly published) and no editorial-only fields (`internal_notes`, `source`, timestamps):

```json
[
  {
    "id": "v00001",
    "name": "The Smokery",
    "slug": "the-smokery",
    "destination": { "id": "marassi", "name": "Marassi" },
    "category": "Restaurant",
    "is_featured": true,
    "is_verified": true,
    "...": "..."
  }
]
```

#### Publish Engine (Sprint 16)

**Why publishing is snapshot-based, not a live query.** A "publish" that just meant "the public API queries `WHERE status = 'approved'` at read time" would leak two problems: it can't answer "what did the site look like on Tuesday" (Rollback needs a real distinct past state to restore, not a re-run of today's filter), and it couples the public read path's performance/availability to the same tables editors are actively writing to. A snapshot decouples both: `publish_revisions.snapshot` is a complete, self-contained copy — `GET /published/venues` never touches `Destination`/`Venue` at all (see `get_current_revision()` in `app/publishing/engine.py`), so heavy draft-table writes can never affect public reads, and a past revision remains a fully faithful copy of exactly what was live at that moment, not a reconstruction.

**Why immutable revisions exist.** `publish_revisions` rows are never updated or deleted by any code path in this codebase — a new publish always *inserts* a new row and flips the pointer, it never rewrites an old one. This is what makes "roll back to how the site looked before" a meaningful, trustworthy operation: if history could be edited, a rollback target might not actually be what was once live. Sprint 16 verified this directly — publishing twice with different draft content in between produced two distinct, independently-readable revisions, with the first left byte-for-byte as it was.

**How Rollback will later reuse this infrastructure.** Everything Rollback needs already exists after this sprint: multiple `publish_revisions` rows persist (never overwritten), each is a complete, independently valid snapshot, and exactly one is ever `is_current` at a time (the partial unique index guarantees this, and `publish()`'s flip-then-insert pattern is the only code path that changes it). Rollback (not built this sprint, per instruction) will be almost the entire inverse of half of `publish()` — flip the *currently* current revision to `false` and flip a *chosen past* revision to `true`, in one transaction, reusing the exact same atomic-pointer-move pattern already proven here. It needs no new snapshot logic at all, only a different source for which row becomes current. Sprint 17's Revision Browser (see below) is the read side of exactly this — it already lets an editor see every past revision and its content, which is the part of Rollback's UX that has nothing to do with the restore action itself.

### `GET /publish/revisions`

Added Sprint 17 — the **Revision Browser**'s list. Returns every `publish_revisions` row, newest first, as `PublishRevisionOut` — metadata only (id, `is_current`, `published_at`, counts), no snapshot. Read-only: nothing here writes `is_current` or touches history in any way.

```json
[
  { "id": 5, "is_current": true, "published_at": "...", "destination_count": 1, "venue_count": 1 },
  { "id": 4, "is_current": false, "published_at": "...", "destination_count": 1, "venue_count": 1 }
]
```

### `GET /publish/revisions/{revision_id}`

Added Sprint 17 — a single revision's full record: the same metadata as above, plus its complete frozen `snapshot`. `404` if the revision doesn't exist. Response is `PublishRevisionDetail`, which extends `PublishRevisionOut` with one additional field, `snapshot: dict`.

**This is inspection, not restoration.** Nothing about this endpoint (or the list above) assigns `is_current` or mutates any row — a client reading an old revision's snapshot here learns what was once live, it doesn't make anything live again. See `POST /publish/revisions/{id}/republish` below for the distinct, `POST`-only action that does write — it reuses this same `GET` shape only for the "which revision did you mean" lookup, never conflating the two.

#### Revision Browser (Sprint 17)

**Why revision history exists.** Once revisions are immutable (Sprint 16), keeping every one of them around costs almost nothing (a few KB of JSONB per publish, per `docs/DATABASE.md`'s own cost analysis) and buys something publishing-by-live-query never could: an actual, inspectable record of what was live at every past point, not just the current moment. Without a way to look at that history, immutability would be a property nobody could verify or use — the data would exist in the table but be practically invisible. The Revision Browser is that visibility: it turns "we keep old revisions" from an implementation detail into something an editor can actually see and reason about.

**Why Rollback was intentionally not part of that sprint.** Reading history and changing what's current are different classes of operation with very different risk profiles — one is side-effect-free and safe to expose immediately, the other is a real, live-affecting write that deserves its own deliberate design. Building the browser first, and proving it against real multi-revision data, meant this sprint's Republish action had a known-working way to let a human *choose* which revision to restore before a single line of restore logic was written — the hard part (can an editor find and understand a past revision) was already solved.

### `POST /publish/revisions/{revision_id}/republish`

Added Sprint 18 — **Republish**, the action Sprint 16/17 flagged as future "Rollback" work. Makes an *existing* revision current again. Takes no request body. Returns the republished revision as `PublishRevisionOut` (metadata only, same shape as `POST /publish`'s response).

- **`404`** if the revision doesn't exist (same shape as every other revision lookup in this API).
- **`409`** (`error: "already_current"`) if the target revision is already the current one — there's nothing to move:
  ```json
  {
    "detail": {
      "error": "already_current",
      "message": "Revision 6 is already the current published revision."
    }
  }
  ```
- On success: the previous current revision (if any) is flipped to `is_current = false`, the target is flipped to `true`, in one transaction — the exact same atomic pattern `publish()` uses, just without building a snapshot first. **No snapshot is read, built, or written anywhere in this code path** — `app/publishing/engine.py`'s `republish()` never queries `Destination`/`Venue` at all, and the republished revision's own `snapshot`/`published_at`/counts are untouched (verified directly: republishing a revision leaves its `published_at` byte-identical to what it was at original publish time).

#### Republish (Sprint 18)

**Why republishing is safer than rewriting history.** The alternative to "move the pointer to an old revision" would be something like "re-run publish, but reconstruct the old data first" — which requires either keeping draft rows in sync with a past state (impossible without destructive edits to *current* draft content) or mutating an old revision's snapshot to make it "current-shaped" again. Both are strictly more dangerous than what Republish actually does: it never reads or writes `destinations`/`venues`, never reconstructs anything, and never touches a snapshot's bytes. The only state that changes is which single row has `is_current = true` — the smallest, most reversible operation that could possibly achieve "make the site show what it showed before."

**Why snapshots remain immutable, even now that there's a reason to want to "restore" one.** It would be tempting to think Republish needs to touch the target snapshot somehow — bump its `published_at`, say, to reflect "when it became current again." Sprint 18 deliberately does neither: the target revision's `snapshot` and `published_at` stay exactly as they were the moment it was first published. This is what makes Republish trustworthy in the first place — if reusing a revision meant mutating it, a second republish of the same revision could no longer be guaranteed to produce byte-identical results to the first. Immutability isn't just Sprint 16's property anymore; Sprint 18 is proof that even the "restore an old state" action doesn't need to compromise it.

## Publishing architecture: still-open pieces

The platform is **not live-edit** — see [`PRODUCT.md`](PRODUCT.md#content--publishing-model) and [`ARCHITECTURE.md`](ARCHITECTURE.md#publishing-architecture). As of Sprint 18, the core mechanism (snapshot + atomic pointer + isolated public read + read-only history browsing + restoring a past revision) is real, verified against Supabase. Still open:

- **Rollback, as a distinct concept from Republish** — Sprint 18's Republish already does the "repoint `is_current` at a past revision" mechanism Rollback needs. What's still open is anything a more fully-featured Rollback might add on top (e.g. a confirmation step with a diff preview, or an audit trail of who rolled back and when, once auth exists) — not the pointer-move itself.
- **The full public/editorial endpoint split** — `GET /published/venues` is the first public-only route, but `GET /venues`/`GET /destinations` still read the draft tables directly and aren't behind any editorial auth yet (auth itself remains undecided). A `GET /published/destinations` companion to `GET /published/venues` also doesn't exist yet — not needed for verification so far, since `PublishedVenueOut` already embeds the resolved `destination: {id, name}` a public consumer needs.
- **A known snapshot edge case, not yet handled**: `publish()` includes a venue only if its own `status` is `approved`, but does not require its `destination` to also be `approved`. If that ever diverges (an approved venue whose destination is still `draft`/`review`), `GET /published/venues` silently skips that venue rather than crashing, since it has no destination name to resolve in the snapshot — flagged as follow-up in `docs/ROADMAP.md`, not fixed this sprint, since the current seed data never exercises it (both the seeded destination and venue are `approved`).

## CORS

As of Sprint 6, `GET` requests are allowed from the Studio dev origins (`http://localhost:5173`, `http://127.0.0.1:5173`) so the browser-based frontend can call this API directly — see `api/app/main.py`. As of Sprint 11, `PATCH` is allowed too, for Save Draft; as of Sprint 12, `POST` is allowed, for Validate. Local dev only; revisit once Studio has a real deployed URL.

## Open decisions

- API style and endpoint conventions beyond the Sprint 1 foundation — not yet designed; FastAPI's built-in OpenAPI/REST conventions are the likely default.
- Authentication/authorization approach — not yet decided (Supabase Auth is the likely default, to be confirmed). Now also needs to answer who can edit, review, publish, and roll back — these may end up as distinct permissions, not just "logged in or not."
- Versioning strategy — not yet decided.
- Exact shape of the public vs. editorial endpoint split above — not yet designed.

## Notes

This document will be extended with real business endpoints and conventions as they're built in future sprints.
