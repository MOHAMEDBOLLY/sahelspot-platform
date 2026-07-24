# API

## Status

Backend stack is **finalized**: Python 3.12 (currently running on 3.13 locally, see [`ARCHITECTURE.md`](ARCHITECTURE.md#known-deviations)), FastAPI, SQLAlchemy 2, Alembic. App startup, config, logging, and a Supabase/PostgreSQL connection have existed since Sprint 1. The data model (Sprint 3) and read endpoints for destinations and venues (Sprint 4, enriched Sprint 8) exist and are verified against a real Supabase database. Sprint 11 added the first write endpoint, `PATCH /venues/{venue_id}` (Save Draft) — no validation, no status transition. Sprint 12 adds the "Validate" gate itself: `POST /venues/{venue_id}/validate`, a read-only canonical check the frontend cannot bypass or duplicate. Sprint 13 evolves that same endpoint's response into an **Editorial Readiness** model (`valid`, `ready_for_review`, `errors`, `warnings`, `info`). Sprint 14 adds the first editorial state transition: `POST /venues/{venue_id}/submit-for-review` moves a venue from `draft` to `review`, gated on `ready_for_review`. Approval, Publish, and revisioning are still not implemented.

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

## Publishing architecture: two endpoint groups, not yet built

The platform is **not live-edit** — see [`PRODUCT.md`](PRODUCT.md#content--publishing-model) and [`ARCHITECTURE.md`](ARCHITECTURE.md#publishing-architecture). This shapes the API into two logically separate groups, planned but **not implemented**:

- **Public endpoints** (e.g. under `/destinations`, `/venues`) will read *only* from the current publish revision (see [`DATABASE.md`](DATABASE.md#publish_revisions)) — never from the `destinations`/`venues` working tables directly. No draft or in-review content can ever be returned by a public endpoint, by construction, not by a filter that could be forgotten.
- **Editorial/admin endpoints** (e.g. under `/admin/...`, authenticated — auth approach still undecided) will manage the draft workflow: create/edit destinations and venues, run validation, move content through review, and trigger the two actions that don't exist in a live-edit system:
  - **Publish** — snapshots all `approved` content into a new publish revision and makes it current.
  - **Rollback** — makes a previous publish revision current again, instantly.
  - Plus a read endpoint to list publish-revision history (for an admin "what's been published, and when" view).

None of this is designed at the request/response level yet — routes, payload shapes, and auth are all open. This section exists so the *shape* of the API (public vs. editorial, and that Publish/Rollback are real actions, not implicit side effects) is decided before the endpoints themselves are.

## CORS

As of Sprint 6, `GET` requests are allowed from the Studio dev origins (`http://localhost:5173`, `http://127.0.0.1:5173`) so the browser-based frontend can call this API directly — see `api/app/main.py`. As of Sprint 11, `PATCH` is allowed too, for Save Draft; as of Sprint 12, `POST` is allowed, for Validate. Local dev only; revisit once Studio has a real deployed URL.

## Open decisions

- API style and endpoint conventions beyond the Sprint 1 foundation — not yet designed; FastAPI's built-in OpenAPI/REST conventions are the likely default.
- Authentication/authorization approach — not yet decided (Supabase Auth is the likely default, to be confirmed). Now also needs to answer who can edit, review, publish, and roll back — these may end up as distinct permissions, not just "logged in or not."
- Versioning strategy — not yet decided.
- Exact shape of the public vs. editorial endpoint split above — not yet designed.

## Notes

This document will be extended with real business endpoints and conventions as they're built in future sprints.
