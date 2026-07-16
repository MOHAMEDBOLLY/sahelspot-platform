# API

## Status

Backend stack is **finalized**: Python 3.12, FastAPI, SQLAlchemy 2, Alembic. No endpoints or application code exist yet.

## Stack

- **Python 3.12**
- **FastAPI** — web framework serving the API.
- **SQLAlchemy 2** — ORM / database toolkit.
- **Alembic** — database migrations.
- **Database**: Supabase (PostgreSQL) — see [`DATABASE.md`](DATABASE.md).

## Open decisions

- API style and endpoint conventions — not yet designed; FastAPI's built-in OpenAPI/REST conventions are the likely default.
- Authentication/authorization approach — not yet decided (Supabase Auth is the likely default, to be confirmed).
- Versioning strategy — not yet decided.

## Notes

This document will be filled in with real endpoints and conventions once API design begins in a future sprint.
