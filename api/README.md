# API

Backend for SahelSpot Platform. Python 3.12 (currently running on 3.13 locally — see note below), FastAPI, SQLAlchemy 2, Alembic.

## Setup

```bash
cd api
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# then edit .env with a real Supabase DATABASE_URL
```

## Database migrations

Schema is managed with Alembic, reading the same `DATABASE_URL` as the app (no separate connection string to keep in sync):

```bash
alembic upgrade head        # apply all migrations
alembic upgrade head --sql  # preview the SQL without connecting to a database
alembic downgrade -1        # roll back the last migration
```

The first migration (`alembic/versions/0001_initial_schema.py`) creates the three tables described in [`../docs/DATABASE.md`](../docs/DATABASE.md): `destinations`, `venues`, `publish_revisions`. Applied and verified against a real Supabase database as of Sprint 3.

## Seed data

```bash
python -m scripts.seed
```

Inserts one destination (`marassi`) and one venue (`v00001` — The Smokery), for local/smoke testing. Safe to re-run — uses `session.merge()` (insert-or-update by primary key), not a plain insert.

## Run

```bash
uvicorn app.main:app --reload
```

- API: http://127.0.0.1:8000
- Swagger UI: http://127.0.0.1:8000/docs
- ReDoc: http://127.0.0.1:8000/redoc

## Endpoints

- `GET /` — API name and version.
- `GET /health` — `{"status": "ok", "database": "connected"}`, or a `503` if the database is unreachable.
- `GET /destinations` — list all destinations, read directly from the `destinations` table.
- `GET /venues` — list all venues, read directly from the `venues` table.
- `GET /venues/{venue_id}` — a single venue by id, or `404`.

**Note**: the three business endpoints above read straight from the draft/editorial tables — they're a Sprint 4 smoke test proving the DB → API → Swagger → JSON pipeline end-to-end, not the final public API. Per [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md#publishing-architecture), the real public API will read only from `publish_revisions` once the publish/rollback endpoints exist — that hasn't been built yet.

## CORS

`app/main.py` allows cross-origin `GET` requests from the Studio dev server (`http://localhost:5173`, `http://127.0.0.1:5173`) so the browser-based frontend can call this API directly. Local dev origins only for now — revisit when Studio has a real deployed URL.

## Note on Python version

The finalized stack specifies Python 3.12. This machine currently has 3.11/3.13/3.14 available and Homebrew cannot install 3.12 without a permissions fix. Per project decision, development is proceeding on **3.13** temporarily; this is tracked as a known deviation in [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) and [`../docs/ROADMAP.md`](../docs/ROADMAP.md) until standardized.
