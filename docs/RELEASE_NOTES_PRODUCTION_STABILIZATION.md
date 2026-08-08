# Release Notes — Production Stabilization

**Tag:** `production-baseline-2026-08-08`
**Commit:** `2c830c54fa833a8add3d732a1eef123d92fb5838`
**Deployed:** 2026-08-08
**Status:** Production Certified (see Known Limitations for the one deferred check)

This release closes a production-readiness gap: the API had accumulated
several completed-but-undeployed engineering priorities (P0, H2, H3, H4)
sitting merged on `main` while production ran an older commit, and one
of the priorities that *was* deployed (H4) exposed a real capacity
defect that required a second, independent fix (R2). This release
brings production current with `main`, fixes what H4 exposed, and adds
one piece of authentication hardening (C1) in its safest possible
rollout state.

## Highlights

- Production API, Studio, and `origin/main` are aligned on a single
  commit for the first time this cycle — verified, not assumed (see the
  Production Certification Report this release closes out).
- A real production incident (`EMAXCONNSESSION` / `HTTP 500` under
  concurrent load) was found, root-caused, and fixed with a single
  reversible dashboard change — no code rollback needed.
- Rate limiting exists in production for the first time.
- The public API can now be cached by anything downstream of it — a
  browser, a CDN, a proxy.

## Infrastructure

- **H4 — two uvicorn workers**, up from one. Removes the single-process
  total-outage failure mode; one wedged worker no longer takes the API
  down.
- **OPS-001 — production nginx restored to a valid state.** A container
  recreation had silently dropped the `--network-alias api` flag
  `proxy_pass` depended on, leaving `nginx -t` failing for roughly 10
  hours undetected (the site stayed up only because the running nginx
  process held a stale-but-still-correct IP in memory). Root-caused,
  fixed by pointing `proxy_pass` at the container's name instead of an
  alias (ADR-0009) — a change that cannot silently regress the way the
  alias did, because Docker refuses to run two containers under the same
  name.
- **R1 — production API redeployed** from a stale commit to the current
  `main`, bringing P0/H2/H3/H4 live for the first time.

## Performance

- **H2 — HTTP caching for `/public/*`.** Every public route now sends
  `Cache-Control` and an `ETag` keyed on the current publish revision,
  and answers a matching `If-None-Match` with `304` from a single
  index-only database lookup — the full snapshot is never loaded on a
  cache hit.
- **H3 — media upload/delete no longer block the event loop.** Storage
  calls moved to `httpx.AsyncClient`; a slow upload no longer stalls
  every other in-flight request on the same worker.
- **H4 — two workers** (see Infrastructure) roughly doubles throughput
  on the platform's 78 synchronous routes under moderate concurrency, on
  top of removing the single-worker outage risk.

## Security

- **H1 — reverse-proxy rate limiting**, in production for the first
  time. Three zones (search, general public, editor), sized from
  measured endpoint cost and validated against real Studio bulk-edit
  traffic patterns so legitimate editorial bursts are not throttled
  (ADR-0008 documents the attachment mechanism).
- **C1 — `AUTO_PROVISION_USERS` gate**, implemented and deployed in its
  safest state (`true` — today's exact prior behavior, unchanged). An
  investigation found that any Supabase identity that successfully
  authenticates and has no `app_users` row is silently granted `viewer`
  access to the entire editorial surface; the code to close that gap now
  exists and is one config flip away from active, once user
  provisioning is ready on the operational side. See Known Limitations.

## Authentication

- No change to how anyone currently logs in. The bootstrap admin's login
  was verified live against production, end-to-end, on this exact
  commit.
- `AUTO_PROVISION_USERS=false` (not yet enabled) will change first-login
  behavior for *unknown* identities only — from silent `viewer`
  provisioning to a structured `403`. Existing users are unaffected by
  the flag in either state.

## Caching

See Performance above (H2). One behavioral note: a publish can now take
up to ~60 seconds to become visible on `/public/*` due to the cache
window — unchanged from H2's original design, just newly live in
production.

## Rate limiting

See Security above (H1). Configured limits, live in production:

| Zone | Rate | Burst |
|---|---|---|
| `/public/search/*` | 5 r/s | 15 |
| `/public/*` (rest), `/`, `/health` | 10 r/s | 30 |
| `/editor/*` | 30 r/s | 60 |

## Database

- **R2 — Supabase Supavisor connection pool size raised from 15 to 30.**
  H4's two workers could together demand 30 client connections, but the
  pooler's session-mode client cap was left at its Nano-tier default of
  15 — undetected until concurrent load testing surfaced
  `EMAXCONNSESSION` and unhandled `HTTP 500`s. Root-caused to the
  dashboard "Pool Size" setting specifically (not Postgres
  `max_connections`, which had ample headroom throughout), fixed by
  raising it — zero code change, zero deployment, zero restart. See
  `docs/adr/0010-supabase-connection-pool-capacity.md` for the full
  investigation and future-review criteria.
- No schema changes this release. Alembic remains at `0016`.

## Developer Experience

- **P0 — the test suite can no longer reach the production database.**
  Previously, `pytest` read the same `DATABASE_URL` the application
  used; a routine local test run had already rewritten publish metadata
  on hundreds of live rows and left the public API with no current
  revision (a real incident, not a hypothetical). A guard now resolves
  the test database from a separate variable, refuses managed-provider
  hosts unconditionally, and installs the safe URL before the
  application's engine is ever built — verified with a negative control
  (the regression fence fails without the fix, passes with it).
- Two ADRs added (`0008`, `0009`) alongside `0010`, documenting the
  design decisions behind H1's nginx attachment and OPS-001's upstream
  fix — previously discussed but not committed as reviewable artifacts.

## Known Limitations

- **`AUTO_PROVISION_USERS` remains `true` in production.** The
  investigated exposure (open Supabase signup → automatic `viewer`
  access) is unresolved until this is deliberately flipped — a separate
  operational decision, not part of this release's scope.
- **Studio's UI-level behavior is unverified for this exact deploy.**
  Build integrity, content correctness, and every HTTP-level check
  passed; the actual rendered application behind Studio's Basic Auth
  gate was not observed live, for lack of credentials available to this
  audit.
- Supabase Network Restrictions remain open to all IP addresses — a
  pre-existing condition, not introduced by this release, surfaced
  during this cycle's security review.
- No APM, uptime monitoring, or alerting exists. Every verification in
  this release was manually triggered.
- Production's git checkout is in detached HEAD, consistent with this
  project's commit-pinned deploy style — not itself a defect, but it
  means a plain `git pull` won't advance it; an explicit `git checkout
  <sha>` is required each deploy.

## Future Work

See `docs/adr/0009-upstream-identification-strategy.md`'s Consequences
section for Docker Compose as the documented long-term target replacing
today's per-container-name identification, and the Next Release Plan in
this cycle's Production Certification / Release Closure report for
prioritized next steps (C2, a version endpoint, monitoring, Studio
credential/UI validation tooling, user management).
