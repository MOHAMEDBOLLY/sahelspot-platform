# Production Checklist — v1.0.0 Release

Release-specific checklist for deploying the commit audited in
`docs/RELEASE_GATE_REPORT.md` and described in
`docs/RELEASE_NOTES_v1.0.0.md`. This is a condensed, release-specific
companion to `docs/RELEASE_CHECKLIST.md` (general pre-flight steps) and
`docs/RUNBOOK.md` (day-to-day command reference) — those two documents
are the source of truth for command syntax; this one calls out what's
specific to *this* release and adds the monitoring/backup checklists
those documents don't fully spell out.

---

## Deployment Checklist

- [ ] **Backup taken** before touching anything —
      `cd api && ./scripts/backup_db.sh`. Confirm the `.sql.gz` file
      exists and is non-empty.
- [ ] **Environment variables confirmed** for every app being deployed
      (see `docs/RELEASE_NOTES_v1.0.0.md`'s "Deployment Requirements"
      section for the full list). In particular:
  - [ ] `ENVIRONMENT=production` explicitly set on the API (not left
        unset — this is what disables `/docs`/`/redoc`/`/openapi.json`).
  - [ ] `ALLOWED_ORIGINS` includes the real deployed Studio origin —
        this release's concurrency protocol needs `ETag` to be an
        exposed CORS header, already configured in code, but only takes
        effect if the origin is actually allowed.
- [ ] **This release's breaking changes are accounted for** — see
      `docs/RELEASE_NOTES_v1.0.0.md`'s "Upgrade Notes":
  - [ ] Confirm no external API client other than Studio calls
        `PATCH /editor/venues/{id}` or `PATCH /editor/destinations/{id}`
        without an `If-Match` header — any that do will start receiving
        `428` after this deploys.
  - [ ] Confirm no external caller still targets
        `PATCH /editor/venues/bulk/category` or
        `PATCH /editor/venues/bulk/destination` — both are gone,
        replaced by `PATCH /editor/venues/bulk`.
- [ ] **Migrations previewed** — `cd api && alembic upgrade head --sql`,
      confirm the output matches expectations (should show `0001`
      through `0010` if deploying to a database that hasn't seen any of
      this release's migrations yet, or fewer if it's already partway
      through).
- [ ] **Builds verified locally:**
  - [ ] API: `docker build -t sahelspot-api:v1.0.0 .` (or the actual
        version tag used) completes cleanly.
  - [ ] Studio: `cd datalab-next && npm ci && npm run build` completes
        cleanly (already verified in this session — see
        `docs/RELEASE_GATE_REPORT.md` §3).
  - [ ] Consumer: `cd consumer && npm ci && NEXT_PUBLIC_API_BASE_URL=<real-value> npm run build`
        completes cleanly.
- [ ] **Backend test suite green** on the exact commit being deployed —
      `cd api && alembic upgrade head && pytest` against a disposable
      Postgres instance (310/310 expected — see
      `docs/RELEASE_GATE_REPORT.md` §2).
- [ ] **Previous image tag/build preserved**, not overwritten — required
      for the rollback checklist below to work.
- [ ] Run migrations: `cd api && alembic upgrade head`.
- [ ] Deploy the new API container.
- [ ] Deploy Studio's `dist/` to its static host / reverse-proxied path.
- [ ] Deploy Consumer (`npm run start` under a process manager that
      restarts it on crash).

---

## Smoke Tests

Run all of these within the first 15 minutes after deploy.

- [ ] `curl -f https://<api-host>/health` → `200`,
      `{"status": "ok", "database": "connected"}`.
- [ ] `curl -f https://<api-host>/docs` → `404` (confirms `ENVIRONMENT`
      took effect; a `200`/Swagger UI here means the API schema is
      publicly exposed).
- [ ] Log into Studio as a real user; confirm no CORS errors in the
      browser console on load.
- [ ] **This release's new/changed paths specifically:**
  - [ ] Open an existing venue, click Edit, change a field, Save Draft
        — confirms `If-Match` is being sent and accepted (a silent
        `428` here would mean the concurrency wiring regressed).
  - [ ] Open the same venue in two tabs, save in one, then try to save
        in the other — confirms the `409` conflict banner and Reload
        control actually appear (this is the one flow this release's
        own audit could not verify live — see
        `docs/RELEASE_GATE_REPORT.md`'s "Known Non-Blocking
        Limitations" §5 — so this is the first real check of it).
  - [ ] Create a venue with category `Beach`, confirm the
        `type`/`publicAccess` fields appear and save.
  - [ ] Publish from the Publishing page, confirm a new revision
        appears in the list.
  - [ ] Export venues (CSV and JSON), confirm both downloads succeed.
  - [ ] Reject a venue in `review` status with a reason, confirm it
        returns to `draft`.
- [ ] `curl -f https://<consumer-host>/` → `200`.
- [ ] `curl -f https://<consumer-host>/search` → `200`.
- [ ] Load `/venues/<a-real-published-id>` on Consumer in a browser,
      confirm it renders (no graceful fallback if the API is
      unreachable here — a `500` means check the API, not Consumer).
- [ ] Check API container logs and Consumer process logs for startup
      errors or unhandled exceptions in the first few minutes.

---

## Rollback Checklist

Roll back immediately if, within the first 15 minutes:

- [ ] `/health` does not return `200` (and it isn't a known,
      already-being-fixed network blip).
- [ ] Any smoke test above fails and the fix isn't an obvious
      config-only correction.
- [ ] Error rate in logs is clearly elevated vs. before the deploy.
- [ ] The `409` conflict flow (the one new behavior this release's own
      audit couldn't verify live) misbehaves — e.g. silently overwrites
      instead of showing the conflict banner.

**Rollback steps, in order of increasing severity:**

- [ ] **Bad API code, schema unaffected:** redeploy the previous image
      tag.
- [ ] **Bad migration (and no data written/corrupted yet):**
      `cd api && alembic downgrade -1`, then redeploy the previous code.
      Every migration `0001`–`0010` has a tested downgrade
      (`docs/PHASE1_COMPLETION_REPORT.md` describes the clean-slate
      round-trip verification discipline used throughout).
- [ ] **Bad Studio deploy:** redeploy the previous `dist/` build.
- [ ] **Bad Consumer deploy:** check out the previous release's source,
      `npm ci && NEXT_PUBLIC_API_BASE_URL=... npm run build`, restart.
- [ ] **Data is wrong, missing, or a migration already
      wrote/corrupted something:** restore the most recent backup (see
      Backup Checklist below) — last resort, loses anything written
      since that backup.
- [ ] After any rollback: re-run the Smoke Tests above against the
      rolled-back state before considering the incident closed.

---

## Monitoring Checklist

*(This deployment currently has no dedicated monitoring stack —
`docs/RELEASE_GATE_REPORT.md` §7/§9 doesn't list one, and none was
found in the repository. The items below are the manual equivalent
until real monitoring exists; add a monitoring section link here once
one is set up.)*

- [ ] Set up (or confirm existing) uptime checks against
      `https://<api-host>/health`, `https://<consumer-host>/`, and
      Studio's static host — polling interval short enough to catch an
      outage within the 15-minute rollback window above.
- [ ] Confirm API container logs are being captured somewhere durable
      (not just `docker logs`, which is lost on container recreation) —
      needed to diagnose anything that happens between deploy windows.
- [ ] Watch error rate / 5xx count for the first 24 hours post-deploy,
      not just the first 15 minutes — the referential-closure exclusion
      path and the `409` conflict path are both new-to-production
      behaviors this release introduces and are the most likely source
      of an unexpected edge case.
- [ ] Confirm the `unhandled_exception_handler` in `app/main.py` is
      actually logging (`logger.exception(...)`) to wherever logs are
      collected — this is the backstop for anything not already an
      `HTTPException`, and it's useless if nothing reads its output.
- [ ] No rate limiting exists yet (`docs/RELEASE_GATE_REPORT.md` §6) —
      until it does, watch for anomalous request volume manually rather
      than assuming the platform will self-protect.

---

## Backup Checklist

- [ ] **Pre-deployment backup taken** — `cd api && ./scripts/backup_db.sh`
      (or to a durable off-host directory / `$BACKUP_DIR`). Confirm the
      resulting `sahelspot_backup_<timestamp>.sql.gz` is non-empty.
- [ ] **Backup is retrievable from outside the VPS** — a backup that
      only exists on the same disk as the database it backs up doesn't
      protect against host-level failure. Copy it off-host (or point
      `BACKUP_DIR` somewhere already off-host) before proceeding.
- [ ] **Restore path known and, ideally, rehearsed** — confirm whoever
      is on call for this deploy knows the restore command (see
      `docs/RUNBOOK.md`'s Restore section), not just the backup command.
      A backup nobody knows how to restore from isn't a real rollback
      option.
- [ ] **Post-deployment backup schedule confirmed running** — this
      release doesn't change backup cadence/retention; confirm whatever
      was already scheduled continues uninterrupted through the deploy
      window (a deploy is not a reason for a scheduled backup to be
      skipped).
