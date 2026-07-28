# Production Deployment Report

**Deployed commit:** `9004f67c9d0cedb43887515f529bdc6bed3727c8` (tag `v1.1.0`)
**Server repo confirmed at same commit:** ✅ (`git rev-parse HEAD` matches on both local and `/opt/sahelspot/repo`)
**Deployment window:** 2026-07-28, ~16:14–16:20 UTC (backups) through ~22:50–22:55 UTC (API cutover + smoke tests)
**Deployment duration:** ~5 minutes of active deploy work (image build, migrations, container swap, nginx reload), plus the backup phase earlier in the session. See "Warnings" below for the actual outage window, which was longer than intended.

---

## Services Restarted

| Service | Action | Reason |
|---|---|---|
| `sahelspot-api` | **Restarted** — new container (`sahelspot-api:v1.1.0`) started, verified healthy internally, then cut over; old container (`sahelspot-api:v1.0.1`) stopped and retained under the name `sahelspot-api-v1.0.1-retired` (not removed — immediate rollback target) | `api/` changed substantially between the running commit and this release (32 commits) |
| `sahelspot-web` (nginx) | **Reloaded** (`nginx -s reload`, not a full restart) | Required to pick up the new API container's IP — see Warnings |
| Studio (static `dist/`) | **Rebuilt in place** — `npm run build` output written directly to the bind-mounted path nginx already serves from; no container restart needed | `datalab-next/` changed substantially |
| `sahelspot-consumer` | **Not restarted** | Verified zero diff in `consumer/` between the previous production commit and this release (`git diff <old>..HEAD -- consumer/` = empty) — rebuilding would have been a no-op risk with no benefit. Image `sahelspot-consumer:v1.1.0` was built for tag consistency but the running `v1.0.0` container was left untouched. |

---

## Backup Locations

All under `/opt/sahelspot/backups/` on the production host:

| File | Contents |
|---|---|
| `sahelspot_pre_deploy_20260728_161447.sql.gz` (38K) | Full `pg_dump` of the production database, taken **before** the migration chain ran. Verified with `gzip -t`. |
| `sahelspot_media_pre_deploy_20260728_161610.tar.gz` (3.9M) | Full tarball of `/opt/sahelspot/media` (on-disk uploaded media). |
| `rollback_snapshot_20260728_161632.txt` | Pre-deploy state: running container names/images, all local image tags, the exact repo commit (`0ff6dcc9...`) and `alembic_version` (`0004`) before this deploy. |
| `deployment_backups/test_destination_backup.sql` (in the repo, from the prior session) | Single-row backup of the `test-dest-98e967ef` row removed to unblock migration `0006`. |

No secret values are present in any of these files (the DB dump contains application data only, per `pg_dump`'s standard behavior; the rollback snapshot is structural metadata only).

---

## Migration Verification

- **Before:** production was at `alembic_version = 0004` — 6 migrations behind, running code from commit `0ff6dcc9` (predates all of Phase 1/2/3).
- **Blocker resolved (prior session):** a stray test row (`test-dest-98e967ef`, region `'Test Region'`) violated migration `0006`'s new `ck_destinations_region` CHECK. Verified zero dependencies (no venues, no FK references, no publish-revision mentions, no activity-log entries), backed up, and deleted by the operator between sessions.
- **Re-verified this session:** the deletion, then re-confirmed every remaining `region`/`category`/`beach_details` value in production is within the new constraints before running anything.
- **Dry run:** `alembic upgrade 0004:head --sql` previewed against the new image — output matched the migration files exactly, no unexpected DDL.
- **Applied:** `alembic upgrade head` — succeeded cleanly, `0004 → 0005 → 0006 → 0007 → 0008 → 0009 → 0010`.
- **After:** `alembic_version = 0010`. Confirmed both remaining rows (`v00001` in `venues`, `marassi` in `destinations`) are intact, with `version = 1` correctly defaulted by the new column.

---

## Smoke Test Results

| Test | Result |
|---|---|
| Homepage (`sahelspot.com`, `www.sahelspot.com`) | ✅ 200 |
| Search (`sahelspot.com/search`) | ✅ 200 |
| API `/health` | ✅ 200, `{"status":"ok","database":"connected"}` |
| API root `/` | ✅ 200 |
| API `/docs` (must be hidden in production) | ✅ 404 — `ENVIRONMENT=production` confirmed in effect |
| API authentication — no token on a protected route | ✅ 401 |
| API authentication — garbage/invalid Bearer token | ✅ 401, `{"detail":"Invalid or expired token"}` (not a 500 — confirms the JWT verification path fails closed) |
| API permissions — protected `/editor/*` route without auth | ✅ 401 |
| Public venues/destinations listings (no auth) | ✅ 200, both return `[]` |
| Public search (`/public/search/venues`) | ✅ 200 |
| CORS preflight from Studio's origin (`Authorization`, `If-Match` headers) | ✅ 200 |
| Studio login page (`admin.sahelspot.com`) | ✅ 401 without Basic Auth credentials — gate is active and responding |
| Consumer venue detail page (`sahelspot.com/venues/v00001`) | ⚠️ 404 — **expected, not a defect**: production has never had a `Publish` action run (`/public/venues` and `/public/destinations` both return `[]`), so no snapshot exists for Consumer to read. Not something this deployment caused or could fix — it's a content/workflow state, not a technical fault. |
| Studio login (real session) | **Not exercised** — no test credentials available in this session |
| Venue editing | **Not exercised** — requires an authenticated Studio session |
| Destination editing | **Not exercised** — requires an authenticated Studio session |
| Publish workflow (actually clicking Publish) | **Not exercised** — requires an authenticated Studio session |
| Image upload | **Not exercised** — requires an authenticated Studio session |
| Image delete | **Not exercised** — requires an authenticated Studio session |

**On the unexercised items:** every one of them was end-to-end verified in the backend test suite (310/310, including concurrency, publish, and reject flows) before this deployment, and the API-level checks above (auth enforcement, CORS, permission gating) cover their common failure mode. But an actual authenticated click-through was not possible in this session, consistent with the same limitation already disclosed in `docs/PHASE3_COMPLETION_REPORT.md` and `docs/RELEASE_GATE_REPORT.md`. **Recommended next step:** a real editor should log into Studio and exercise venue edit → save → publish once, as the first genuine end-to-end confirmation.

---

## Warnings

1. **A real ~4.5 minute API outage occurred, not the "minimal downtime" intended.** Root cause: nginx's `proxy_pass http://api:8000;` resolves the `api` hostname to a container IP **once**, at config load/reload time — it does not re-resolve automatically when the container behind that name changes, even though Docker's embedded DNS updates immediately. I started the new container under the same network alias before stopping the old one (intending an overlap), but nginx had already cached the old container's IP from before the deploy and kept sending traffic there — which then became unreachable the moment the old container was stopped and renamed. External requests to `api.sahelspot.com` returned `502 Bad Gateway` (confirmed via `sahelspot-web`'s captured request log) from approximately 22:50:26 to 22:54:46 UTC, until I ran `nginx -s reload` to force re-resolution. This is now fixed and verified (`/health` returns 200 externally), but it was real, user-facing downtime I did not anticipate and should disclose plainly rather than characterize as "minimal."
   - **For next time:** either reload nginx immediately as part of every container-swap deploy (not an afterthought), or configure nginx with a `resolver` directive and a variable-based `proxy_pass` so it re-resolves automatically — worth a follow-up, not done in this session per the "no refactoring" instruction.
2. **A production database credential was briefly exposed in this session's tool output** (an earlier turn, before this deployment resumed) — a `docker inspect`/`env` command intended to extract one variable printed the full container environment instead, including the DB password embedded in `DATABASE_URL`. This was flagged immediately when it happened and the user was advised to rotate the credential; all commands since then were restructured to extract only single named values and avoid ever dumping full environment output. **This is not resolved by this deployment** — rotating the Supabase Postgres password is an action outside this session's scope and still outstanding.
3. Production has **no content published yet** (`/public/venues` and `/public/destinations` both `[]`) — not a regression, but worth knowing before assuming Consumer "isn't working."
4. Every non-blocking finding from `docs/RELEASE_GATE_REPORT.md` (no rate limiting, stale `DATABASE.md`/`API.md`, the `activity_log` index model-declaration gap, bounded bulk-endpoint N+1, un-split frontend bundle) still applies — none were in scope for this deployment and none were touched.
5. `sahelspot-api-v1.0.1-retired` and the `sahelspot-api:v1.0.0`/`v1.0.1` images are still present on the host, deliberately not removed — they're the fastest rollback path (see below) and should be cleaned up only after this release has been running stably for a while.

---

## Rollback Instructions

**API (fastest path — no rebuild needed):**
```bash
ssh root@187.55.226.126
docker stop sahelspot-api
docker rename sahelspot-api sahelspot-api-v1.1.0-rolled-back
docker rename sahelspot-api-v1.0.1-retired sahelspot-api
docker start sahelspot-api
docker exec sahelspot-web nginx -s reload   # do not skip — see Warning 1
```

**Schema rollback (only if the new columns/constraints are themselves the problem — not needed for an API-only issue):**
```bash
# From a container running the new image (has the 0005-0010 migration files):
docker run --rm --network sahelspot_net --env-file /opt/sahelspot/repo/api/.env \
  sahelspot-api:v1.1.0 sh -c "cd /app && alembic downgrade 0004"
```
Every migration 0005–0010 has a tested downgrade (verified during Phase 1). Do this only after confirming via `docs/RUNBOOK.md`'s rollback guidance that the migration itself — not the application code — is the actual problem, since a schema downgrade after new-shape data has been written could lose that data.

**Full restore from backup (last resort):**
```bash
# Database:
gunzip -c /opt/sahelspot/backups/sahelspot_pre_deploy_20260728_161447.sql.gz | \
  docker run --rm -i postgres:17 psql "<DATABASE_URL, postgresql:// form>"

# Media:
tar -xzf /opt/sahelspot/backups/sahelspot_media_pre_deploy_20260728_161610.tar.gz -C /opt/sahelspot
```

**Studio:** no rollback artifact was taken for the previous `dist/` build specifically (it was overwritten in place) — to roll back, `git checkout 0ff6dcc9 -- datalab-next` in `/opt/sahelspot/repo`, rebuild (`npm run build`), no container action needed since nginx serves the directory directly.

**Consumer:** untouched by this deployment — no rollback action needed.

---

## Production Readiness Verdict

**Deployed successfully.** All automatable smoke tests pass. Two real issues occurred during the deploy itself (documented in Warnings, both now resolved or explicitly flagged as outstanding): a ~4.5-minute API outage from a DNS-caching gap in the nginx swap procedure, and an earlier credential-exposure incident in this session's own tooling that still requires a password rotation outside this session's scope. Authenticated in-app flows (Studio login, venue/destination editing, publish, image upload/delete) were not exercised live and should be the first manual check performed against this release.
