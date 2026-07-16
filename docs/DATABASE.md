# Database

## Status

Database engine is **finalized**: Supabase (PostgreSQL). No schema, tables, or migrations have been created yet.

## Stack

- **Supabase** — hosted PostgreSQL, providing the database plus (likely) auth and storage as the platform grows.
- **SQLAlchemy 2** — ORM / database toolkit, used from the `api/` backend.
- **Alembic** — migration tool, used to version and apply schema changes.

## Open decisions

- Schema design — not started; depends on product scope defined in [`PRODUCT.md`](PRODUCT.md).
- Migration workflow (local dev vs. Supabase environments) — not yet decided.
- Row-level security / access policy usage — not yet decided.

## Notes

This document will be filled in with real tables and relationships once schema work begins in a future sprint.
