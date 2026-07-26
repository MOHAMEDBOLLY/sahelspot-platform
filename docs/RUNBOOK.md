# Operations Runbook

Practical, command-level reference for running the SahelSpot Platform in
production. For the full deployment process and reasoning, see
[`DEPLOYMENT.md`](DEPLOYMENT.md); this is the short version for when
you're actually doing one of these things.

## Deploy

1. Back up the database (see **Backup** below) — always, before any
   migration.
2. `cd api && alembic upgrade head`
3. Build and start the new API container (see `DEPLOYMENT.md`'s
   deployment sequence for the exact commands).
4. Build and publish the frontend (`cd datalab-next && npm ci && npm run
   build`, deploy `dist/`).
5. Run a health check (below) before considering the deploy done.

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

- **Bad application code, schema unaffected:** redeploy the previous
  image tag. This only works if previous tags were kept — don't build
  over `latest` in place.
- **Bad migration:** `cd api && alembic downgrade -1`, then redeploy the
  previous code. Only appropriate if the migration itself is what's
  wrong, not if it already wrote/corrupted data — in that case, restore
  from backup instead.
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

There is no log aggregation or alerting configured — this is a manual
`docker logs` check today, not a dashboard. That's a deliberate scope
boundary for this release, not an oversight.
