# Deployment Guide

Production deployment for the SahelSpot Platform API. Assumes a single
Docker-capable host (a VPS or equivalent), Supabase as the managed
database + storage, and GitHub Actions as CI. Nothing more elaborate than
that is required — see `docs/ARCHITECTURE.md` for why.

The frontend (`datalab-next/`) is a static build (`npm run build` →
`dist/`) and can be served by any static host or the same VPS behind a
reverse proxy; it has no server-side runtime of its own, so it isn't
covered step-by-step here beyond the env vars it needs.

## Prerequisites

- A Supabase project (Postgres database + Storage bucket + Auth already
  configured — this predates this guide, see `docs/DATABASE.md` and
  `docs/ARCHITECTURE.md`).
- Docker installed on the target host.
- A reverse proxy in front of the container that terminates HTTPS (nginx,
  Caddy, or your host's managed load balancer). The container itself only
  serves plain HTTP on port 8000 — it does not handle TLS.
- PostgreSQL client tools (`pg_dump`, `psql`) installed wherever you run
  backups/restores from (see `api/scripts/`) — not required on the host
  running the container itself, only wherever you operate on the database.

## Required environment variables

Set these on the host running the API container (e.g. via `docker run -e`,
an env file passed to Docker, or your platform's secrets manager). See
`api/.env.example` for the authoritative, commented list — this is a
summary:

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Supabase Postgres connection string. |
| `SUPABASE_JWT_SECRET` | Yes | Project Settings → API → JWT Secret. App refuses to start without it. |
| `ALLOWED_ORIGINS` | Yes for a real deploy | Comma-separated list of the frontend's real deployed URL(s). Defaults to the local dev origins — **must** be set, or the browser-based frontend can't call the API at all. |
| `SUPABASE_URL` | For media uploads | Project's base URL. Upload returns `503` (not a crash) if unset. |
| `SUPABASE_SERVICE_ROLE_KEY` | For media uploads | Server-side only — never expose this to the frontend. |
| `MEDIA_BUCKET` | No | Defaults to `venue-media`. |
| `BOOTSTRAP_ADMIN_USER_ID` | Recommended | The Supabase user id that gets auto-promoted to `admin` on first login. Without it, the first `app_users` row must be promoted manually (see `docs/RUNBOOK.md`). |
| `LOG_LEVEL` | No | Defaults to `INFO`. |
| `ENVIRONMENT` | No | Informational only (`development`/`staging`/`production`); nothing branches on it today. |

Frontend build-time variables (`datalab-next/.env.example`):

| Variable | Required |
|---|---|
| `VITE_API_BASE_URL` | Yes — the deployed API's URL. |
| `VITE_SUPABASE_URL` | Yes |
| `VITE_SUPABASE_ANON_KEY` | Yes — safe to expose, identifies the project only. |

## Migration process

Schema changes are Alembic migrations under `api/alembic/versions/`. They
are **not** run automatically by the Docker image — the container's
`CMD` only starts `uvicorn`. Run migrations as an explicit step before
starting (or restarting) the API:

```bash
cd api
alembic upgrade head
```

This is a deliberate, separate step, not baked into the container's
startup, so a migration failure is visible on its own and never masked by
"the app looks like it started fine." Run it from anywhere with network
access to the database and the same `DATABASE_URL` the app uses —
typically the deploy host itself, before the container (re)starts.

To preview the SQL a pending migration would run, without applying it:

```bash
alembic upgrade head --sql
```

## Deployment sequence

See **Production Startup** below for the full ordered sequence and why it
matters — this section is the command-level how-to for one deploy.

1. **Build the image**
   ```bash
   cd api
   docker build -t sahelspot-api:<tag> .
   ```
2. **Take a backup** (see `api/scripts/backup_db.sh`) before running any
   migration — this is the one point in a deploy where a mistake is hard
   to undo.
3. **Run migrations** against the target database (`alembic upgrade
   head`, above).
4. **Stop the old container, start the new one**, passing the environment
   variables listed above:
   ```bash
   docker run -d \
     --name sahelspot-api \
     -p 8000:8000 \
     --env-file /path/to/production.env \
     sahelspot-api:<tag>
   ```
5. **Build and publish the frontend**:
   ```bash
   cd datalab-next
   npm ci
   npm run build
   # deploy dist/ to your static host / reverse-proxied path
   ```
6. **Verify** — see Health Verification below.

## Health verification

```bash
curl -f https://<your-api-host>/health
```

Expected response, `200`:
```json
{"status": "ok", "database": "connected"}
```

A `503` with `{"status": "error", "database": "disconnected"}` means the
container is up but can't reach the database — check `DATABASE_URL` and
network/firewall rules before assuming the deploy itself failed.

Also confirm the frontend can actually reach the API from a real browser
(not just `curl`) — a CORS misconfiguration (`ALLOWED_ORIGINS` not
matching the deployed frontend's origin) won't show up in `/health` at
all, only as failed requests in the browser console.

## Rollback procedure

Rollback has two independent parts — code and schema — because a bad
deploy might involve either, both, or neither.

**Application code:**
```bash
docker run -d --name sahelspot-api -p 8000:8000 --env-file /path/to/production.env sahelspot-api:<previous-tag>
```
This only works if you keep previous image tags around — don't overwrite
`latest` in place; tag builds so the last few are addressable (e.g. by git
SHA or version).

**Database schema** (only if the failed deploy included a migration):
```bash
cd api
alembic downgrade -1
```
Every migration in this project has a real, tested `downgrade()` (verified
across all four as of this writing) — but downgrading is still a schema
change against live data, so prefer restoring from the pre-deploy backup
(step 2 above) if the migration did anything more than add a nullable
column. `alembic downgrade -1` is the right tool for "the migration itself
was fine, the code deployed on top of it wasn't" — not for "the migration
corrupted data," which is what the backup is for.

**If data is actually wrong or lost:** restore the backup taken in step 2
of the deployment sequence — see `api/scripts/restore_db.sh` and
`docs/RUNBOOK.md`.

## Production Startup

The correct order, and why each step depends on the one before it:

```
Database
   ↓
Migration
   ↓
Backend
   ↓
Frontend
   ↓
Health Check
```

1. **Database** must be reachable first — every step after this needs it,
   and there's nothing to migrate or serve against a database that isn't
   up.
2. **Migration** runs next, against the now-reachable database, *before*
   the new backend code starts — the backend's models assume the schema
   already matches what that code expects (there's no runtime schema
   negotiation). Running migrations after starting the new backend risks
   a window where running code queries columns/tables that don't exist
   yet.
3. **Backend** starts once the schema is current. It fails fast if
   required config (`DATABASE_URL`, `SUPABASE_JWT_SECRET`) is missing,
   and `/health` won't report healthy until it can actually reach the
   database — so this step is self-verifying to a degree, but isn't
   confirmed until step 5.
4. **Frontend** is deployed last among the application pieces because it
   has a hard runtime dependency on the backend already being live at
   `VITE_API_BASE_URL` — deploying it first just means real users hit a
   working UI backed by a nonexistent or stale API.
5. **Health Check** is the explicit confirmation step, not an assumption.
   Nothing earlier in this sequence guarantees the whole chain actually
   works end to end — CORS, network rules, and env var typos all pass
   silently through steps 1-4 and only surface here (or in a real browser
   against the frontend).
