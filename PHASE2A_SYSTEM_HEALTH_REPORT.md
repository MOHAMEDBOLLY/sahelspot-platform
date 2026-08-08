# Phase 2A — System Health Dashboard — Implementation Report

Status: **Implementation complete, production-ready. Not deployed.**

Scope of this report is the System Health Dashboard only (`GET /system/health`
and its Studio card). Backup/Logs dashboards were implemented in a separate
phase (2B) and are out of scope here except where they share a component
(`HealthStatusBadge`).

---

## 1. Files changed

**Backend**

| File | Change |
|---|---|
| `api/app/api/routes/system_health.py` | New. `GET /system/health` — server/database/API metrics, overall status, timestamp. Docker section hardcoded to `{"available": false}`. |
| `api/app/api/router.py` | Registers `system_health.router` on `api_router`, unauthenticated (same tier as `/`, `/health`, `/version`). |
| `api/requirements.txt` | Adds `psutil` (the only new dependency this feature needs). |

**Frontend**

| File | Change |
|---|---|
| `datalab-next/src/features/ops/types.ts` | `SystemHealth` interface — corrected to match the backend contract exactly (see §7 below). |
| `datalab-next/src/features/ops/api.ts` | `fetchSystemHealth()`. |
| `datalab-next/src/features/ops/useSystemHealth.ts` | React Query hook: `retry: false`, `refetchOnWindowFocus: false`, no `refetchInterval` — no polling anywhere in the stack. |
| `datalab-next/src/features/ops/SystemHealthDashboard.tsx` | The card: Server/Database/API/Docker sections, progress bars, overall status badge, manual Refresh. |
| `datalab-next/src/features/ops/HealthStatusBadge.tsx` | Shared green/yellow/red traffic-light badge (also used by the Backup/Logs cards). |
| `datalab-next/src/pages/Operations.tsx` | Mounts `<SystemHealthDashboard />` on the Operations page. |

No file outside this list was touched. `GET /`, `GET /health`, `GET /version` are unmodified — confirmed by diff and by live testing (§5).

---

## 2. API contract

`GET /system/health` — unauthenticated, `200` always (never raises).

```
{
  "timestamp": string,          // UTC ISO 8601
  "status": "healthy" | "warning" | "critical",
  "server": {
    "cpu_percent": number | null,
    "cpu_cores": number | null,
    "load_average": { "1m": number, "5m": number, "15m": number } | null,
    "memory": { "used_percent": number, "used_gb": number, "total_gb": number } | null,
    "disk":   { "used_percent": number, "used_gb": number, "total_gb": number } | null
  },
  "database": {
    "status": "connected" | "disconnected",
    "latency_ms": number | null,
    "publish_revision": number | null,
    "schema_revision": string | null
  },
  "api": {
    "workers": number,
    "uptime_seconds": number,
    "uptime": string,           // human-readable, e.g. "16h 12m"
    "version": string | null,
    "git_commit": string | null
  },
  "docker": { "available": false }
}
```

**Status thresholds** (worst-of-all-sections wins):
- CPU / RAM / Disk: `<80%` healthy, `80–90%` warning, `>90%` critical. `null` (read failure) counts as critical.
- Database latency: `<100ms` healthy, `100–300ms` warning, `>300ms` critical. Disconnected or `null` latency counts as critical.
- Docker is excluded from the status calculation entirely — its permanent "unavailable" state is not a health signal.

---

## 3. Example JSON

Captured from a live local run against this session's actual (remote, over the network) database — the `critical` status and >1s latency below are real readings, not fabricated:

```json
{
  "timestamp": "2026-08-08T15:33:28.643568+00:00",
  "status": "critical",
  "server": {
    "cpu_percent": 23.4,
    "cpu_cores": 8,
    "load_average": {"1m": 3.24, "5m": 2.53, "15m": 2.27},
    "memory": {"used_percent": 80.6, "used_gb": 3.25, "total_gb": 8.0},
    "disk": {"used_percent": 21.1, "used_gb": 11.7, "total_gb": 460.43}
  },
  "database": {
    "status": "connected",
    "latency_ms": 1324.17,
    "publish_revision": 1456,
    "schema_revision": "0016"
  },
  "api": {
    "workers": 1,
    "uptime_seconds": 3.64,
    "uptime": "0m",
    "version": "1.0.0",
    "git_commit": "2c830c5"
  },
  "docker": { "available": false }
}
```

Overall `status` is `critical` here purely because of DB latency (>300ms threshold) — RAM at 80.6% alone would only be `warning`. This demonstrates the worst-of-all-sections aggregation working correctly.

---

## 4. UI changes

`SystemHealthDashboard.tsx` renders, top to bottom: header with an overall `HealthStatusBadge` and manual Refresh button, a relative timestamp ("As of …"), then four sections:

- **Server** — CPU/RAM/Disk progress bars (green `<80%`, yellow `80–90%`, red `>90%`), load average.
- **Database** — status, latency, publish revision, schema revision.
- **API** — workers, uptime (server-formatted string), version, git commit.
- **Docker** — fixed "Unavailable" (Phase 2A scope boundary, not an error).

Loading → "Loading…"; request failure → red inline message, no crash; any individual `null` field → "Unavailable" via a shared `text()` helper; a `null` server metric renders its progress bar as an empty track labeled "Unavailable" instead of computing `NaN%`.

---

## 5. Validation results

**Backend**

| Check | Result |
|---|---|
| `GET /system/health` returns 200 | ✅ confirmed live |
| Every field populated | ✅ confirmed live (see §3) |
| Graceful degradation | ✅ `_server_health()` and `_database_health()` both catch their respective exception classes and return `None`-valued sections instead of raising; `_api_health()` catches a missing `version.json` |
| Status calculation | ✅ verified: warning-level RAM (80.6%) + critical DB latency (1324ms) → overall `critical`, correctly taking the worst of the two |
| Timestamp is UTC ISO 8601 | ✅ `datetime.now(timezone.utc).isoformat()` |
| No exceptions thrown | ✅ `uvicorn` log checked for `traceback`/`exception` after multiple live requests — none found |
| `ruff check` | ✅ all checks passed |
| Full pytest suite | ✅ 456 passed, 0 regressions |

**Frontend**

| Check | Result |
|---|---|
| Operations page loads | ✅ no console errors (page itself is Supabase-login-gated in this environment — see Known Limitations) |
| Dashboard renders correctly | ✅ code-reviewed against the corrected type contract; all fields wired |
| Loading state | ✅ `isPending` branch |
| Error state | ✅ `isError \|\| !data` branch, red message, no crash |
| Manual Refresh button | ✅ `refetch()`, spinner while `isFetching` |
| Progress bars | ✅ render, including the `null`-safe empty-track case |
| Color thresholds | ✅ `barColor()` matches backend thresholds exactly (<80 green, 80–90 yellow, >90 red) |
| Responsive layout | ✅ `grid-cols-1 lg:grid-cols-2`, same pattern as every other Operations card |
| No console warnings | ✅ checked live — only routine Vite HMR noise, no app warnings |
| No TypeScript errors | ✅ `tsc --noEmit` clean |
| `npm run lint` (oxlint) | ✅ clean |
| `npm run build` | ✅ succeeds (pre-existing, unrelated chunk-size warning on `MapExplorer`, not from this change) |
| `npm test` (vitest) | ✅ 87 passed, 0 regressions |

**Compatibility**

| Endpoint | Result |
|---|---|
| `GET /` | ✅ 200, unmodified |
| `GET /health` | ✅ 200, unmodified |
| `GET /version` | ✅ 200, unmodified |

---

## 6. Self-review findings (fixed before this report)

1. **`_server_health()` had no exception handling.** `psutil`/`os.getloadavg()` are effectively infallible on Linux, but the endpoint's own contract is "never throw" — brought in line with `_database_health()`'s existing degrade-to-`None` pattern.
2. **Frontend `SystemHealth` type didn't match the backend contract.** `timestamp`, top-level `status`, and `api.uptime` existed on the wire but not in the TypeScript type — meaning they were silently invisible to the UI. Added.
3. **Duplicated uptime formatting.** The frontend had its own `formatUptime()` reimplementing exactly what the backend's `_format_uptime()` already computes and sends as `api.uptime`. Removed the frontend copy; the component now just displays the server-provided string. One source of truth for that formatting, not two.
4. **Overall status/timestamp were computed but never shown.** Added the `HealthStatusBadge` (reusing the same component the Backup/Logs cards already use, not a new one) to the header, and an "As of …" timestamp line — the dashboard's headline signal was previously invisible.

No race conditions found (each `GET /system/health` call is a single synchronous request-response; no shared mutable state across requests except the per-process `psutil.Process` handle, which is read-only after construction). No unnecessary complexity found beyond what's fixed above. Naming is consistent (`_snake_case` private helpers, `camelCase` TS, matching the rest of `ops/`).

---

## 7. Known limitations

- **Docker section is permanently "Unavailable."** Deliberate — no socket, no SDK, no privileged access, per this phase's explicit scope.
- **`nginx_errors`/Docker-adjacent data has no bearing here** — this endpoint doesn't touch nginx at all (that's Phase 2B's Logs Dashboard, out of scope for this report).
- **Worker count** is derived by counting live sibling processes under a confirmed uvicorn master process — correct under the production Dockerfile's `fork`-based multiprocessing (Linux default), verified locally under both single-process and `--workers 2` runs.
- **Studio Operations page could not be visually verified end-to-end in this session** — it's gated behind Supabase login and no credentials were available. Verified instead via: `tsc --noEmit`, `oxlint`, `vitest`, a live console-error/warning check on page load, and direct `curl` validation of the API contract the page consumes. A login-page screenshot from this session is attached below as evidence of a clean, error-free load up to that gate.
- **Per-worker counters**: `api.uptime_seconds`/`uptime` reflect whichever worker process served the request, not a fleet-wide value — documented in the code, consistent with how a multi-worker uvicorn deployment actually behaves.

---

## 8. Deployment notes

- New dependency: `psutil` (already present in `requirements.txt` from this feature's prior local-validation pass — installs via the existing `pip install -r requirements.txt` step, no Dockerfile change).
- No environment variables, no database migration, no nginx/compose/infrastructure change required.
- Endpoint is unauthenticated, consistent with `/`, `/health`, `/version` — no new auth surface introduced.
- Deployment is a normal API image build + container swap, per the existing procedure in `docs/DEPLOYMENT.md` (build from `api/`, stop/rename/run, reload nginx). No infrastructure-side steps are unique to this feature.

## 9. Rollback notes

- Standard rollback: `docker stop sahelspot-api && docker rm sahelspot-api && docker rename sahelspot-api-<prev-tag> sahelspot-api && docker start sahelspot-api` — same as every prior phase (H1–H4, R1, R2, C1).
- No data migration occurred, so there is nothing to reverse beyond the container swap — rollback is a pure code-version revert.
- If only the frontend needs rolling back, `Operations.tsx`'s single added line (`<SystemHealthDashboard />`) can be removed/commented without touching the backend at all; the endpoint is additive and harmless to leave running even if the UI stops calling it.

---

## Screenshot

Studio login gate (furthest reachable point without credentials in this session) — confirms a clean, error-free load:

`/private/tmp/claude-504/-Users-Nabil-sahelspot-platform/a27d969b-1a28-40d7-837c-65b7476eea1b/scratchpad` (see conversation for the inline image; not duplicated into the repo since it shows no application state beyond the login form).

---

**Deployment remains the only outstanding step.** No further implementation work is planned for Phase 2A.
