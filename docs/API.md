# API

## Status

Backend stack is **finalized**: Python 3.12 (currently running on 3.13 locally, see [`ARCHITECTURE.md`](ARCHITECTURE.md#known-deviations)), FastAPI, SQLAlchemy 2, Alembic. App startup, config, logging, and a Supabase/PostgreSQL connection have existed since Sprint 1. The data model (Sprint 3) and read endpoints for destinations and venues (Sprint 4, enriched Sprint 8) exist and are verified against a real Supabase database. Sprint 11 added the first write endpoint, `PATCH /venues/{venue_id}` (Save Draft) — no validation, no status transition. Sprint 12 adds the "Validate" gate itself: `POST /venues/{venue_id}/validate`, a read-only canonical check the frontend cannot bypass or duplicate. Publish and revisioning are still not implemented.

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

Added Sprint 12 — the **Validate** gate described in [`DATABASE.md`](DATABASE.md#editorial-status-one-shared-vocabulary-renamed-to-avoid-colliding-with-the-new-meaning-of-publish): the application-level check a row must pass before it can move from `draft` to `review`. Read-only — it reports whether the venue *would* pass, it doesn't move `status` itself (Review isn't built yet). `404` if the venue doesn't exist.

Runs against the venue's **currently persisted** row, not a request body — there's nothing to submit, since Validate checks what's already saved (run Save Draft first if there are unsaved edits).

Response (`ValidationResult`, from the new `app/validation/` package — a shape meant to be reused by every future entity's validator, not just venues):

```json
{
  "valid": false,
  "errors": [
    { "field": "latitude", "message": "Latitude must be between 30.6 and 31.1." }
  ]
}
```

`valid: true` implies an empty `errors` array. This is the **canonical** validation — the backend's business rules, and the only place they're enforced:

- `name` non-blank.
- `category` one of the documented `VENUE_CATEGORIES` (already DB-enforced by a `CHECK` constraint at write time, but re-checked here too so a bad value produces this structured response instead of a raw constraint-violation error).
- `latitude`/`longitude`, when present, within the observed North Coast range (`[30.6, 31.1]` / `[28.6, 29.4]`) — a sanity bound per `DATABASE.md`, not a DB constraint, which is exactly why it's enforced in application code rather than a `CHECK`.

The frontend's Edit Mode runs its own lightweight checks (required-ness, character limits, URL/number format) for instant typing feedback and to gate the Save Draft button — see `datalab-next/src/lib/validation.ts` and `features/venues/venueValidation.ts`. Those are UX conveniences only; they never re-implement the rules above, and the backend never trusts them — every rule that decides whether a venue is actually fit to publish is checked here and only here.

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
