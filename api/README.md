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

The first migration (`alembic/versions/0001_initial_schema.py`) creates the three tables described in [`../docs/DATABASE.md`](../docs/DATABASE.md): `destinations`, `venues`, `publish_revisions`. It hasn't been applied to any real database yet — that needs a live Supabase `DATABASE_URL` in `.env`.

## Run

```bash
uvicorn app.main:app --reload
```

- API: http://127.0.0.1:8000
- Swagger UI: http://127.0.0.1:8000/docs
- ReDoc: http://127.0.0.1:8000/redoc

## Endpoints (Sprint 1)

- `GET /` — API name and version.
- `GET /health` — `{"status": "ok", "database": "connected"}`, or a `503` if the database is unreachable.

## Note on Python version

The finalized stack specifies Python 3.12. This machine currently has 3.11/3.13/3.14 available and Homebrew cannot install 3.12 without a permissions fix. Per project decision, development is proceeding on **3.13** temporarily; this is tracked as a known deviation in [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) and [`../docs/ROADMAP.md`](../docs/ROADMAP.md) until standardized.
