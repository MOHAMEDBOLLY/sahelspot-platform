# Database

## Status

Database engine is **finalized**: Supabase (PostgreSQL). As of Sprint 1, the API connects to Postgres via a SQLAlchemy engine and exposes a connectivity check at `GET /health`. No schema, tables, models, or migrations have been created yet — Alembic is a dependency of the API but has not been initialized (no models exist yet for it to migrate).

## Stack

- **Supabase** — hosted PostgreSQL, providing the database plus (likely) auth and storage as the platform grows.
- **SQLAlchemy 2** — ORM / database toolkit, used from the `api/` backend (`api/app/db/session.py`).
- **Alembic** — migration tool, used to version and apply schema changes. Not yet initialized — will be set up when the first model is introduced.
- **psycopg 3** — PostgreSQL driver used by SQLAlchemy to connect to Supabase.

## Connection

The API reads a single `DATABASE_URL` environment variable (see `api/.env.example`) in the form:

```
postgresql+psycopg://<user>:<password>@<host>:<port>/<database>
```

This is not committed — each environment (local, staging, production) supplies its own via `.env` or platform environment variables.

## Open decisions

- Schema design — not started; depends on product scope defined in [`PRODUCT.md`](PRODUCT.md).
- Migration workflow (local dev vs. Supabase environments) — not yet decided.
- Row-level security / access policy usage — not yet decided.

## Notes

This document will be filled in with real tables and relationships once schema work begins in a future sprint.
