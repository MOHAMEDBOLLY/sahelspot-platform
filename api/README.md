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
- `/editor/*` — the authenticated editorial API (destinations, venues, publishing, activity log, user role management). Requires a Supabase-issued JWT and, per route, a specific permission — see [`../docs/API.md`](../docs/API.md).
- `/public/*` — unauthenticated reads of the current published snapshot only — never the draft tables.

Full route inventory and request/response shapes: [`../docs/API.md`](../docs/API.md). Interactive docs (Swagger/ReDoc, below) are always the source of truth for the exact current schema.

## CORS

`app/main.py` reads allowed origins from `ALLOWED_ORIGINS` (see `.env.example`) — no wildcard, defaults to the Studio dev server if unset. A production deployment must set this to the frontend's real deployed URL, or browser requests will be rejected — see [`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md).

## Production deployment

See [`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md) for the full deployment guide, and [`../docs/RUNBOOK.md`](../docs/RUNBOOK.md) for day-to-day operations (deploy, rollback, backup, restore, health checks, logs). Database backup/restore scripts live in `scripts/backup_db.sh` / `scripts/restore_db.sh`.

## Note on Python version

The finalized stack specifies Python 3.12. This machine currently has 3.11/3.13/3.14 available and Homebrew cannot install 3.12 without a permissions fix. Per project decision, development is proceeding on **3.13** temporarily; this is tracked as a known deviation in [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) and [`../docs/ROADMAP.md`](../docs/ROADMAP.md) until standardized.
