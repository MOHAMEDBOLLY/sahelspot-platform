# Deployment Guide

Production deployment for the SahelSpot Platform: the API, the internal
editorial Studio (`datalab-next/`), and the public consumer site
(`consumer/`). Assumes a single Docker-capable host (a VPS or
equivalent), Supabase as the managed database + storage, and GitHub
Actions as CI. Nothing more elaborate than that is required — see
`docs/ARCHITECTURE.md` for why.

**Studio** (`datalab-next/`) is a static build (`npm run build` → `dist/`)
with no server-side runtime of its own — served by any static host or the
same VPS behind a reverse proxy, covered here only for its env vars.

**Consumer** (`consumer/`) is a Next.js app with server-rendered dynamic
routes (`/search`, `/venues/[id]`) — unlike Studio, it **cannot** be
deployed as static files; it needs a running Node process. See its own
section below.

## Production Stabilization release (2026-08-08)

Tagged `production-baseline-2026-08-08`, commit `2c830c5`. See
`docs/RELEASE_NOTES_PRODUCTION_STABILIZATION.md` for the full write-up;
summarized here because each item changed something this guide
describes:

| Item | What changed | Where it's documented |
|---|---|---|
| **P0** | Test suite isolated from ever reaching the production database | `docs/TESTING.md`, `api/tests/database_guard.py` |
| **OPS-001** | Fixed `proxy_pass` upstream identification (container name, not a network alias that had silently gone missing) | `docs/adr/0009-upstream-identification-strategy.md` |
| **H1** | Reverse-proxy rate limiting added | [Rate limiting](#rate-limiting-h1) below, `docs/adr/0008-rate-limit-attachment-strategy.md` |
| **H2** | `/public/*` gained `ETag`/`Cache-Control`/`304` support | `docs/API.md` |
| **H3** | Media upload/delete no longer block the event loop | `api/app/media/service.py` |
| **H4** | API runs 2 uvicorn workers, not 1 | This guide's `docker run`/Dockerfile references, below |
| **R1 / R2** | Production redeployed from H1–H4; Supabase connection pool size raised 15→30 to fit the new worker count | `docs/adr/0010-supabase-connection-pool-capacity.md` |
| **C1** | `AUTO_PROVISION_USERS` setting added (deployed `true` — no behavior change; hardening to `false` is a deliberate future step) | `api/.env.example` |

The `docker run`/rollback commands throughout this guide already reflect
the post-H4/OPS-001 state (2 workers baked into the image, no host port
publish, network + restart-policy flags, mandatory nginx reload). If
you're reading an old copy of this file, that's the tell it predates
2026-08-08.

## Prerequisites

- A Supabase project (Postgres database + Storage bucket + Auth already
  configured — this predates this guide, see `docs/DATABASE.md` and
  `docs/ARCHITECTURE.md`).
- Docker installed on the target host, for the API.
- Node.js 20+ installed on the target host, for `consumer/` — it runs as
  a persistent Node process (`next start`), not a static file host. There
  is no Dockerfile for it today (see the Consumer Deployment section
  below for exactly what that means in practice).
- A reverse proxy in front of both the API container and the consumer
  Node process that terminates HTTPS (nginx, Caddy, or your host's
  managed load balancer). Neither serves TLS itself — the API listens on
  plain HTTP on port 8000, `consumer/` on port 3000 by default.
  **This proxy is also where the API's rate limits live** — see
  [Rate limiting](#rate-limiting-h1) below.
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
| `ENVIRONMENT` | **Yes, for a real deploy** | Controls real behavior, not just informational: `Settings.docs_enabled` (`api/app/core/config.py`) serves `/docs`, `/redoc`, and `/openapi.json` only when this is exactly `"development"` — anything else (`staging`, `production`, unset-and-defaulted, or a typo) disables all three. Set this explicitly to `production` (or `staging`) in any real deployment, or the API's full schema and route surface stays publicly browsable. |

Studio build-time variables (`datalab-next/.env.example`):

| Variable | Required |
|---|---|
| `VITE_API_BASE_URL` | Yes — the deployed API's URL. |
| `VITE_SUPABASE_URL` | Yes |
| `VITE_SUPABASE_ANON_KEY` | Yes — safe to expose, identifies the project only. |

Consumer build-time variables (`consumer/.env.example`):

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Yes | The deployed API's URL, `/public/*` only — `consumer/` has no authentication and never calls `/editor/*`. **Must be set before `npm run build`, not before `npm run start`** — `NEXT_PUBLIC_`-prefixed variables are inlined into the build output at build time (verified directly: setting it only at start time has no effect at all). Defaults to `http://localhost:8000` if unset at build time, **silently** — there is no fail-fast check on this variable today, so an unset value doesn't crash the build, it just bakes in a value that will make every page show "unavailable" in production, with nothing in the logs pointing at why. |

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

## Consumer deployment

`consumer/` (the public site) is a Next.js app with server-rendered
dynamic routes (`/search`, `/venues/[id]`) — it needs a running Node
process, not a static file host. This is the one thing worth getting
right before deploying it: following Studio's "any static host" pattern
for `consumer/` would leave those two routes broken in production.

- **Runtime:** Node.js 20+ (matches the CI job's `node-version`, see
  `.github/workflows/ci.yml`).
- **Build command:** `npm ci && npm run build`, run from `consumer/`,
  **with `NEXT_PUBLIC_API_BASE_URL` already set in the environment** —
  see the note below.
- **Start command:** `npm run start` (runs `next start`), run from
  `consumer/`, after the build above. This is a long-running foreground
  process — it needs to stay running (a process manager, your platform's
  native Node/Next.js support, or an equivalent) the same way `uvicorn`
  does for the API; there is no Dockerfile or process-supervisor config
  for it in this repository today, so that choice is yours to make at
  deploy time, not something this guide prescribes.
- **Port:** `3000` by default (Next.js's own default; not currently
  overridden anywhere in this repo). Pass `-p <port>` to `next start` to
  change it.
- **API endpoint configuration:** `NEXT_PUBLIC_API_BASE_URL`, set to the
  deployed API's public URL — see the environment variables table above.
  **This must be set before the build command runs, not before start** —
  verified directly: `next build` inlines `NEXT_PUBLIC_*` variables into
  the build output, so setting it only at start time has no effect at
  all. Rebuild whenever this value needs to change; restarting alone
  won't pick up a new one.
- **Reverse proxy:** same expectation as the API — `next start` serves
  plain HTTP, so put it behind the same TLS-terminating reverse proxy
  (nginx, Caddy, or your host's load balancer), proxying to whatever port
  it's actually listening on.

**Rollback**, today, is less mature than the API's: there is no built-
artifact versioning equivalent to the API's Docker image tags. Rolling
back means checking out the previous release's source, rebuilding
(`npm run build`), and restarting the process — slower than the API's
"redeploy the previous tag," and worth knowing before an incident, not
during one.

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
4. **Stop the old container, rename it (don't remove — it's your fastest
   rollback), start the new one.** Verified production practice as of the
   2026-08-08 baseline does **not** publish port 8000 to the host — the
   API is reachable only through the reverse proxy, on its own Docker
   network:
   ```bash
   docker stop sahelspot-api
   docker rename sahelspot-api sahelspot-api-<old-tag>-retired
   docker run -d \
     --name sahelspot-api \
     --network sahelspot_net \
     --restart unless-stopped \
     --env-file /path/to/production.env \
     sahelspot-api:<tag>
   ```
   **Then reload the reverse proxy — this step is not optional.**
   `proxy_pass` resolves its upstream hostname once, at nginx config load
   time; it does not notice the new container's IP on its own, even
   though Docker's embedded DNS updates immediately. Skipping this step
   caused a real ~4.5-minute production outage (`502` on every request)
   during an earlier deploy in this project's history — see
   `docs/PRODUCTION_DEPLOYMENT_REPORT.md` and OPS-001's investigation.
   ```bash
   docker exec sahelspot-web nginx -t && docker exec sahelspot-web nginx -s reload
   ```
5. **Build and publish Studio** (`datalab-next/`). If the host has no
   native Node.js install (verified true for the current production
   host — `node`/`npm` are not on `PATH`), build in a throwaway container
   instead of installing Node on the host:
   ```bash
   cd datalab-next
   docker run --rm -v "$PWD:/app" -w /app node:20-slim \
     sh -c "cp .env.production .env.local && npm ci && npm run build && rm .env.local"
   ```
   `dist/` is what gets deployed — see the note below on *how* for why no
   restart or reload is needed for this one.

   **How Studio actually goes live:** if `dist/` is the same host
   directory bind-mounted into the proxy container (verified true for
   production — `/opt/sahelspot/repo/datalab-next/dist` →
   `/usr/share/nginx/datalab`, read-only, as a **directory** mount, not a
   single-file one), the new build takes effect immediately on the next
   request — nginx serves static files fresh from disk per request, with
   no restart or reload required. This is a different case from the
   nginx *config* file below: a single-file bind mount is pinned by
   inode and does require special handling; a directory mount that's
   itself the served root does not.
6. **Build and start Consumer** (`consumer/`) — see Consumer deployment
   above. `NEXT_PUBLIC_API_BASE_URL` must be set **before** the build
   step, not the start step:
   ```bash
   cd consumer
   npm ci
   NEXT_PUBLIC_API_BASE_URL=https://<your-api-host> npm run build
   npm run start
   ```
7. **Verify** — see Health Verification below.

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

Also check `GET /version` and `GET /system/health` return `200` — both
are new as of the Version Information / System Health Dashboard phases
(see `docs/API.md`) and are what Studio's Operations page actually
depends on. **A backend-only deploy is not the whole picture for
anything touching `datalab-next/`** — this project's Phase 2A/2B
production deployment initially validated the API correctly but missed
that Studio's static `dist/` build (step 5 above) hadn't been rebuilt,
so the new dashboard wasn't visible even though every API check passed.
Confirm the Studio bundle actually contains what you expect
(`grep -l "<a string unique to the new feature>" datalab-next/dist/assets/*.js`)
whenever a deploy includes frontend changes, not just that the build
command exited `0`.

Also confirm the frontend can actually reach the API from a real browser
(not just `curl`) — a CORS misconfiguration (`ALLOWED_ORIGINS` not
matching the deployed frontend's origin) won't show up in `/health` at
all, only as failed requests in the browser console.

**Consumer has no equivalent `/health` endpoint.** Verify it directly:

```bash
curl -f https://<your-consumer-host>/
curl -f https://<your-consumer-host>/search
```

Both should return `200` regardless of whether the API is reachable —
the homepage and search page both catch a failed API call and render an
"unavailable" message rather than erroring. That graceful handling does
**not** extend to a venue detail page (`/venues/{id}`): if the API is
unreachable, that specific route currently returns a bare `500` instead
of a friendly message (there's no try/catch around its data fetch) — a
`500` there specifically, with the homepage/search still `200`, points at
an unreachable or misconfigured API, not a consumer deployment problem.
If `NEXT_PUBLIC_API_BASE_URL` itself was wrong at build time, expect all
three to show "unavailable"/fail consistently, not just the venue page —
and remember a rebuild, not a restart, is what's needed to fix that.

## Rollback procedure

Rollback has independent parts — API code, schema, Studio, and Consumer —
because a bad deploy might involve any subset of them.

**API code — fastest path, if the previous container is still retained
(not removed) from the deploy that's being rolled back:**
```bash
docker stop sahelspot-api && docker rm sahelspot-api
docker rename sahelspot-api-<previous-tag>-retired sahelspot-api
docker start sahelspot-api
docker exec sahelspot-web nginx -t && docker exec sahelspot-web nginx -s reload
```
This is why the deploy sequence above renames rather than removes the
outgoing container — it turns rollback into a rename instead of a
rebuild. If it was already removed, rebuild from the previous tag
instead:
```bash
docker run -d --name sahelspot-api --network sahelspot_net \
  --restart unless-stopped --env-file /path/to/production.env \
  sahelspot-api:<previous-tag>
docker exec sahelspot-web nginx -t && docker exec sahelspot-web nginx -s reload
```
Either way, **the nginx reload is required**, for the same upstream-IP
reason as the forward deploy above. This only works if you keep previous
image tags around — don't overwrite `latest` in place; tag builds so the
last few are addressable (e.g. by git SHA or version).

**Consumer code:** check out the previous release's source and rebuild
(`npm ci && NEXT_PUBLIC_API_BASE_URL=... npm run build`), then restart the
process. There is no image-tag equivalent for it today — this is
necessarily slower than the API's rollback, which is exactly why it's
worth deciding your process-management approach (and keeping a previous
build or checkout on hand) before you need it, not during an incident.

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
API
   ↓
Studio  +  Consumer
   ↓
Health Check
```

1. **Database** must be reachable first — every step after this needs it,
   and there's nothing to migrate or serve against a database that isn't
   up.
2. **Migration** runs next, against the now-reachable database, *before*
   the new API code starts — the API's models assume the schema already
   matches what that code expects (there's no runtime schema
   negotiation). Running migrations after starting the new API risks a
   window where running code queries columns/tables that don't exist yet.
3. **API** starts once the schema is current. It fails fast if required
   config (`DATABASE_URL`, `SUPABASE_JWT_SECRET`) is missing, and
   `/health` won't report healthy until it can actually reach the
   database — so this step is self-verifying to a degree, but isn't
   confirmed until step 5.
4. **Studio and Consumer** are deployed last among the application pieces
   because both have a hard runtime dependency on the API already being
   live — Studio at `VITE_API_BASE_URL`, Consumer at
   `NEXT_PUBLIC_API_BASE_URL` (baked in at Consumer's *build* time,
   specifically — see Consumer deployment above). Deploying either first
   just means real users hit a working UI backed by a nonexistent or
   stale API.
5. **Health Check** is the explicit confirmation step, not an assumption.
   Nothing earlier in this sequence guarantees the whole chain actually
   works end to end — CORS, network rules, and env var typos all pass
   silently through steps 1-4 and only surface here (or in a real browser
   against either frontend).

## Rate limiting (H1)

The API ships no application-level rate limiting. Limits are enforced at
the reverse proxy this guide already requires, using
[`deploy/nginx.conf`](../deploy/nginx.conf).

**Why the proxy and not the application.** The API runs two uvicorn
workers (H4) that share no state — there is no Redis and no in-process
cache anywhere in the codebase — so an in-application counter would be
per-worker, enforcing a configured limit of N as an effective 2N. The
proxy is a single process in front of both, so its counters are correct.
It also rejects abusive traffic before that traffic can occupy a
threadpool thread or a database connection, which application-level
limiting cannot do.

### Applying it

**Merging this config does not rate-limit production.** It takes effect
only once an operator adopts it. Either `include` it from your existing
nginx configuration, or port the three `limit_req_zone` directives and
their matching `limit_req` lines into whatever proxy you run — Caddy and
managed load balancers have equivalents.

```bash
# nginx: place it where your other server blocks live, then
nginx -t && nginx -s reload
```

| Zone | Scope | Rate | Burst |
|---|---|---|---|
| `sahelspot_search` | `/public/search/*` | 5 r/s | 15 |
| `sahelspot_public` | `/public/*`, `/`, `/health` | 10 r/s | 30 |
| `sahelspot_editor` | `/editor/*` | 30 r/s | 60 |

Search is limited far more tightly than the rest of `/public/*` because
it is the one public route the H2 caching layer cannot protect: each
distinct query string is a distinct cache entry, so varying `q` bypasses
the cache and forces a full snapshot load every time. `/editor/*` is
deliberately the loosest — Studio's bulk operations issue one request per
item sequentially, and `burst=60` lets a 50-item bulk action through
untouched.

Also set: `client_max_body_size 6m`, so an oversized upload is rejected
at the edge instead of being buffered by the application first.

### Required: the API must not be reachable except through the proxy

Rate limits key on the proxy's own view of the TCP peer
(`$binary_remote_addr`), which cannot be spoofed by a header. But if the
API container's port 8000 is reachable directly, that path has no limits
at all. Publish port 8000 only on the proxy's network, or firewall it —
this is a deployment requirement, not an application setting.

(Separately, the API's `--forwarded-allow-ips=*` means the *application*
trusts `X-Forwarded-For` from any peer. That affects the client IP
recorded in auth-failure logs, not the enforcement of these limits.
Narrowing it to the proxy's address is worthwhile once the proxy address
is fixed, and is tracked separately.)

### Verifying

```bash
# Should return 200s, then 429s once the burst is consumed
for i in $(seq 1 40); do curl -s -o /dev/null -w '%{http_code} ' \
  https://<your-api-host>/public/search/venues?q=test; done
```

A rejected request returns `429` with `Retry-After` and the same
structured body shape as every other API error:

```json
{"detail": {"error": "rate_limited", "message": "Too many requests. Please slow down and try again."}}
```

### Tuning

`deploy/nginx.conf` logs `$limit_req_status` (PASSED / DELAYED /
REJECTED) per request. Run with the limits in place and watch for
sustained REJECTED on legitimate traffic — particularly during a real
bulk operation in Studio — before tightening anything. The numbers above
are derived from measured endpoint cost, not from observed production
traffic.
