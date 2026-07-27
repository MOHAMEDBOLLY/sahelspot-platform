# Release Checklist

A practical, pre-flight checklist for a production deploy of the API,
Studio (`datalab-next/`), and Consumer (`consumer/`). See
[`DEPLOYMENT.md`](DEPLOYMENT.md) for the reasoning behind each step and
[`RUNBOOK.md`](RUNBOOK.md) for the day-to-day command reference.

## Pre-deployment

- [ ] **Backup taken** — `cd api && ./scripts/backup_db.sh` (or to a
      directory off the VPS). Confirm the resulting `.sql.gz` file exists
      and is non-empty before proceeding.
- [ ] **Environment variables set and correct**, for whichever
      app(s) you're deploying:
  - API: `DATABASE_URL`, `SUPABASE_JWT_SECRET`, `ALLOWED_ORIGINS`
    (matches the real deployed frontend origin(s)), `ENVIRONMENT`
    (explicitly `production` or `staging` — **not** left unset, or
    `/docs`/`/redoc`/`/openapi.json` stay publicly browsable), and, if
    media uploads are used, `SUPABASE_URL` +
    `SUPABASE_SERVICE_ROLE_KEY`.
  - Studio: `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`,
    `VITE_SUPABASE_ANON_KEY` — set before `npm run build`.
  - Consumer: `NEXT_PUBLIC_API_BASE_URL` — set before `npm run build`,
    **not** before `npm run start` (it's inlined at build time; setting
    it only at start time has no effect).
- [ ] **Migrations reviewed** — `cd api && alembic upgrade head --sql` to
      preview the SQL before applying it for real. Confirm it matches
      what you expect from the code change being deployed.
- [ ] **Build verified locally** before deploying:
  - API: the Docker image builds cleanly (`docker build -t
    sahelspot-api:<tag> .`).
  - Studio: `npm ci && npm run build` completes without error.
  - Consumer: `npm ci && NEXT_PUBLIC_API_BASE_URL=<real-value> npm run
    build` completes without error.
- [ ] **Tests pass** — the backend test suite (`cd api && pytest`) is
      green on the commit being deployed.

## Deployment

**API:**
- [ ] Run migrations: `cd api && alembic upgrade head`.
- [ ] Build and start the new container, passing the environment file
      (see `DEPLOYMENT.md`'s deployment sequence for the exact command).
- [ ] Confirm the previous image tag is still available (not
      overwritten), in case a rollback is needed.

**Studio:**
- [ ] `cd datalab-next && npm ci && npm run build`.
- [ ] Deploy `dist/` to its static host or reverse-proxied path.

**Consumer:**
- [ ] `cd consumer && npm ci`.
- [ ] `NEXT_PUBLIC_API_BASE_URL=<real-api-url> npm run build` — variable
      set **before** this command.
- [ ] `npm run start`, under a process manager that will restart it if it
      dies (none is included in this repo — supply your own).
- [ ] Confirm the reverse proxy in front of it (port 3000 by default) is
      routing correctly and terminating TLS.

## Post-deployment

- [ ] **Smoke test the API:** `curl -f https://<api-host>/health` returns
      `200` with `{"status": "ok", "database": "connected"}`.
- [ ] **Smoke test Studio:** load it in a real browser, confirm it can
      reach the API (watch the browser console for CORS errors — these
      won't show up in `/health`).
- [ ] **Smoke test Consumer:** `curl -f https://<consumer-host>/` and
      `.../search` both return `200`. Load `/venues/<a-real-id>` in a
      browser and confirm it renders (this route has no graceful
      fallback if the API is unreachable — a `500` here specifically
      means check the API, not Consumer).
- [ ] **Check logs** for both the API container (`docker logs
      sahelspot-api`) and the Consumer process, for startup errors or
      unhandled exceptions in the first few minutes after deploy.
- [ ] **Confirm `ENVIRONMENT` took effect:** `curl -f
      https://<api-host>/docs` should return `404` in production/staging
      — if it returns the Swagger UI, `ENVIRONMENT` is not set correctly
      and the full API schema is publicly exposed.
- [ ] **Rollback criteria** — roll back immediately if any of the
      following are true within the first 15 minutes:
  - `/health` does not return `200` and the cause isn't a known,
    already-being-fixed network blip.
  - Any smoke test above fails and the fix isn't obviously a
    config-only correction (e.g. a missed env var you can hot-fix
    without a full redeploy).
  - Error rate in the logs is clearly elevated compared to before the
    deploy.
  - See [`RUNBOOK.md`](RUNBOOK.md#rollback) for the exact rollback
    commands for each app.
