# Operations Runbook

Practical, command-level reference for running the SahelSpot Platform in
production — the API, Studio (`datalab-next/`), and the public consumer
site (`consumer/`). For the full deployment process and reasoning, see
[`DEPLOYMENT.md`](DEPLOYMENT.md); this is the short version for when
you're actually doing one of these things.

## Startup

**API:**
1. Back up the database (see **Backup** below) — always, before any
   migration.
2. `cd api && alembic upgrade head`
3. Build and start the new API container (see `DEPLOYMENT.md`'s
   deployment sequence for the exact commands). The container fails fast
   if `DATABASE_URL` or `SUPABASE_JWT_SECRET` is missing.
4. Run a health check (below) before moving on to Studio/Consumer —
   both depend on the API already being live.

**Studio:** `cd datalab-next && npm ci && npm run build`, deploy `dist/`
to your static host or reverse-proxied path. No process to start — it's
static files.

**Consumer:** `cd consumer && npm ci`, then
`NEXT_PUBLIC_API_BASE_URL=https://<your-api-host> npm run build`
(the env var **must** be set before this build step — it's inlined at
build time, not read at start time), then `npm run start`. This is a
long-running foreground process on port 3000 by default; keep it running
with a process manager (systemd, pm2, your platform's native Node
support — none is prescribed by this repo, since none is included in it).

**First deploy only — promoting the first admin:** if `BOOTSTRAP_ADMIN_USER_ID`
wasn't set before that user's first login, their `app_users` row was
auto-provisioned as `viewer`. Promote it directly in Supabase's SQL editor
(or `psql`):
```sql
UPDATE app_users SET role = 'admin' WHERE id = '<supabase-user-id>';
```
Once one real admin exists, every subsequent role change goes through
`PATCH /editor/users/{id}/role` (Studio's Users page) instead — this
manual step is only ever needed once.

## Shutdown

**API:** `docker stop sahelspot-api` (or your platform's equivalent).
Uvicorn handles `SIGTERM` gracefully, finishing in-flight requests before
exiting — no separate drain step needed.

**Consumer:** stop the `next start` process via whatever is supervising
it (`systemctl stop`, `pm2 stop`, etc.) — there's no separate shutdown
hook to run; it's a plain Node process.

**Studio:** nothing to shut down — it's static files served by whatever
host serves them; taking it down means removing/replacing those files or
stopping the host itself.

Shutting down the API without also stopping Studio/Consumer leaves both
frontends up but unable to reach it — they'll show connection errors or
(Consumer's homepage/search only) the graceful "unavailable" state, not a
crash.

## Restart

**API:** stop and start the same image/tag — no migration step unless
you're also deploying new code (see **Deploy** below for that case). A
restart alone never runs `alembic upgrade head`.

**Consumer:** stop and re-run `npm run start` from the existing build
output. A restart does **not** pick up a new `NEXT_PUBLIC_API_BASE_URL` —
that requires a rebuild (see **Deploy** below).

**Studio:** nothing to restart; re-serve the existing `dist/` or rebuild
if the source changed.

## Deploy

1. Back up the database (see **Backup** below) — always, before any
   migration.
2. `cd api && alembic upgrade head`
3. Build and start the new API container (see `DEPLOYMENT.md`'s
   deployment sequence for the exact commands).
4. Build and publish Studio (`cd datalab-next && npm ci && npm run
   build`, deploy `dist/`).
5. Build and start Consumer (`cd consumer && npm ci &&
   NEXT_PUBLIC_API_BASE_URL=https://<your-api-host> npm run build &&
   npm run start`) — the env var must be set before `npm run build`, not
   before `npm run start`.
6. Run a health check (below) before considering the deploy done.

**First deploy only — promoting the first admin:** if `BOOTSTRAP_ADMIN_USER_ID`
wasn't set before that user's first login, their `app_users` row was
auto-provisioned as `viewer`. Promote it directly in Supabase's SQL editor
(or `psql`):
```sql
UPDATE app_users SET role = 'admin' WHERE id = '<supabase-user-id>';
```
Once one real admin exists, every subsequent role change goes through
`PATCH /editor/users/{id}/role` (Studio's Users page) instead — this
manual step is only ever needed once.

## Rollback

- **Bad API code, schema unaffected:** redeploy the previous image tag.
  This only works if previous tags were kept — don't build over `latest`
  in place.
- **Bad migration:** `cd api && alembic downgrade -1`, then redeploy the
  previous code. Only appropriate if the migration itself is what's
  wrong, not if it already wrote/corrupted data — in that case, restore
  from backup instead.
- **Bad Consumer deploy:** check out the previous release's source,
  rebuild (`npm ci && NEXT_PUBLIC_API_BASE_URL=... npm run build`), and
  restart. There's no image-tag equivalent for it today — slower than
  the API's rollback, so keep a previous checkout or build on hand
  before an incident, not during one.
- **Data is wrong or missing:** restore the most recent good backup (see
  **Restore** below). This is the last resort, not the first — restoring
  loses anything written since that backup was taken.

## Backup

```bash
cd api
./scripts/backup_db.sh                    # writes to api/backups/
./scripts/backup_db.sh /var/backups/sahel  # or any other directory
```

Produces a timestamped, gzip-compressed SQL dump:
`sahelspot_backup_<YYYYMMDD>_<HHMMSS>.sql.gz`. Exits non-zero (and
removes the partial file) if `pg_dump` fails — a failed backup is never
silently left looking like a successful one.

**When to run it:** before every migration, before every restore, and on
whatever regular schedule your team decides on separately (e.g. a daily
cron job calling this script) — scheduling is deliberately not built into
the script itself, so it stays a plain, reviewable command you can also
run by hand at any time.

Store backups somewhere other than the VPS running the database's client
— a backup that lives only on the same host as the thing it's backing up
doesn't protect against that host failing.

## Restore

```bash
cd api
./scripts/restore_db.sh api/backups/sahelspot_backup_20260727_120000.sql.gz
```

Prompts for an explicit `yes` before touching the database — there's no
non-interactive flag, deliberately. Only restore into a database you
intend to fully replace; restoring on top of one still in active use will
produce duplicate-row/conflict errors rather than a clean merge.

**Before restoring in a real incident:** confirm you're pointed at the
right `DATABASE_URL` (the script prints it back to you before asking for
confirmation) — there's no undo once it starts.

## Health Check

```bash
curl -f https://<your-api-host>/health
```

- `200 {"status": "ok", "database": "connected"}` — healthy.
- `503 {"status": "error", "database": "disconnected"}` — the API is up
  but can't reach the database. Check `DATABASE_URL`, Supabase's status,
  and network/firewall rules, in that order.
- No response / connection refused — the container itself isn't running,
  or the reverse proxy in front of it is misconfigured.

`/health` only proves the API can reach the database — it says nothing
about CORS or the frontend. If users report the app not working but
`/health` is green, check `ALLOWED_ORIGINS` and the browser console next.

**Consumer has no `/health` endpoint.** Check it directly:
```bash
curl -f https://<your-consumer-host>/
curl -f https://<your-consumer-host>/search
```
Both return `200` even when the API is unreachable — the homepage and
search page catch a failed API call and render an "unavailable" message
rather than erroring. `/venues/{id}` does **not** have this protection:
an unreachable API produces a bare `500` there specifically. A `500` on
the venue page with the homepage/search still `200` points at the API,
not at the Consumer deployment itself; all three failing/showing
"unavailable" points at a wrong `NEXT_PUBLIC_API_BASE_URL` baked in at
build time (fix requires a rebuild, not a restart).

**Studio** has no health endpoint either — it's static files; "healthy"
just means the host serving `dist/` responds and the API it points at
(`VITE_API_BASE_URL`) is healthy.

## Log Inspection

The app logs to stdout (`api/app/core/logging.py`, plain text, level
controlled by `LOG_LEVEL`) — there's no separate log file to find inside
the container. How you read it depends on how you're running it:

```bash
docker logs sahelspot-api           # recent logs
docker logs -f sahelspot-api        # follow live
docker logs --since 1h sahelspot-api
```

What to look for:
- Every unhandled exception is logged with a full traceback (Sprint 31's
  global exception handler, `api/app/main.py`) — search for `Unhandled
  exception on` to find them.
- `/health` failures log `Database health check failed` with a traceback
  (`api/app/api/routes/system.py`).
- Bulk-operation failures that aren't a normal `HTTPException` (e.g. a
  dropped DB connection mid-batch) log `Unexpected error updating
  category/destination for venue <id>` (`api/app/api/routes/venues.py`).

**Consumer** logs to stdout/stderr of the `next start` process — read it
through whatever supervises that process (`journalctl -u <service>`,
`pm2 logs`, or the raw terminal/redirect it's running under, since there
is no `docker logs` equivalent without a container). Next.js logs
unhandled request errors (e.g. the `/venues/{id}` 500 case above) there
directly.

There is no log aggregation or alerting configured for either app — this
is a manual log check today, not a dashboard. That's a deliberate scope
boundary for this release, not an oversight.

## Troubleshooting

- **`/health` returns `503`:** `DATABASE_URL` is wrong, or Supabase is
  unreachable from the host. Check network/firewall rules before
  assuming the deploy failed.
- **API container won't start at all:** check `docker logs` — it fails
  fast on a missing/empty `DATABASE_URL` or `SUPABASE_JWT_SECRET` with a
  clear validation error at startup, before ever binding a port.
- **Frontend (Studio or Consumer) loads but every API call fails in the
  browser console, while `curl`-ing `/health` directly works:** almost
  always `ALLOWED_ORIGINS` not including that frontend's actual deployed
  origin — a CORS failure, not a reachability failure.
- **`/docs`, `/redoc`, or `/openapi.json` unexpectedly returns `404` in a
  deployment where you expected them:** `ENVIRONMENT` is not exactly
  `"development"` — this is intentional in any real deployment (see
  `docs/SECURITY.md`), not a bug. If you expected them enabled, you set
  `ENVIRONMENT` wrong for what you're doing.
- **`/docs` etc. are unexpectedly reachable in a production deployment:**
  `ENVIRONMENT` was left unset or misspelled — set it explicitly to
  `production`.
- **Consumer shows "unavailable" on every page:** `NEXT_PUBLIC_API_BASE_URL`
  was wrong (or unset, defaulting to `http://localhost:8000`) at *build*
  time. Rebuild with the correct value — restarting the existing build
  will not fix it.
- **Consumer's venue detail page 500s but homepage/search are fine:** the
  API is genuinely unreachable or erroring — this page has no graceful
  fallback (a known, documented gap, not a deployment mistake). Check the
  API's own health/logs.
- **A migration fails partway:** restore from the pre-migration backup
  (see **Restore** above) rather than attempting to manually patch the
  schema — `alembic downgrade -1` assumes the migration ran cleanly to
  completion, which a partial failure may not satisfy.
