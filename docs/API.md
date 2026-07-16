# API

## Status

Backend stack is **finalized**: Python 3.12 (currently running on 3.13 locally, see [`ARCHITECTURE.md`](ARCHITECTURE.md#known-deviations)), FastAPI, SQLAlchemy 2, Alembic. The API foundation exists as of Sprint 1: app startup, config, logging, a Supabase/PostgreSQL connection, and two system endpoints. No business logic, models, or CRUD endpoints exist yet.

## Stack

- **Python 3.12**
- **FastAPI** — web framework serving the API.
- **SQLAlchemy 2** — ORM / database toolkit.
- **Alembic** — database migrations (not yet initialized — no models to migrate yet).
- **Database**: Supabase (PostgreSQL) — see [`DATABASE.md`](DATABASE.md).

Interactive docs (Swagger UI) are available at `/docs`, ReDoc at `/redoc`, generated automatically by FastAPI.

## Endpoints (Sprint 1)

### `GET /`

Returns API name and version.

```json
{
  "name": "SahelSpot API",
  "version": "0.1.0"
}
```

### `GET /health`

Returns database connectivity status.

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

As of Sprint 6, `GET` requests are allowed from the Studio dev origins (`http://localhost:5173`, `http://127.0.0.1:5173`) so the browser-based frontend can call this API directly — see `api/app/main.py`. Local dev only; revisit once Studio has a real deployed URL.

## Open decisions

- API style and endpoint conventions beyond the Sprint 1 foundation — not yet designed; FastAPI's built-in OpenAPI/REST conventions are the likely default.
- Authentication/authorization approach — not yet decided (Supabase Auth is the likely default, to be confirmed). Now also needs to answer who can edit, review, publish, and roll back — these may end up as distinct permissions, not just "logged in or not."
- Versioning strategy — not yet decided.
- Exact shape of the public vs. editorial endpoint split above — not yet designed.

## Notes

This document will be extended with real business endpoints and conventions as they're built in future sprints.
