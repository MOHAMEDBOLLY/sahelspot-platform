# SahelSpot — Production Readiness

**Status: Planning document. Read-only audit — no code was modified to produce this report.**

This is the single source of truth for taking SahelSpot from Release Candidate (`mobile-2027-rc1` / Consumer, `v1.0.0` / Studio+API) to Production. It supersedes nothing — `docs/PRODUCTION_CHECKLIST.md` and `docs/RELEASE_GATE_REPORT.md` remain valid historical records of the v1.0.0 Studio/API launch audit, but they predate Consumer entirely and don't cover it. This document is the first production-readiness pass that spans all three apps together.

**Where this document's claims come from:** direct reads of `docs/SECURITY.md`, `docs/DEPLOYMENT.md`, `docs/RUNBOOK.md`, `docs/TESTING.md`, `docs/DATABASE.md`, `.github/workflows/ci.yml`, `api/app/core/config.py`, `api/app/main.py`, `api/Dockerfile`, `consumer/Dockerfile`, `consumer/app/{robots,sitemap,layout}.ts(x)`, and repo-wide greps for rate-limiting and observability tooling — not assumptions. Every classification below is grounded in what the code and existing docs actually show today, cited inline.

---

## 1. Current Product Status

| Subsystem | Status | Basis |
|---|---|---|
| **Consumer** | ✓ Complete (Mobile 2027, mobile-only) | `mobile-2027-rc1` tagged and pushed; all 7 core screens (Home, Saved, Venue Details, Search, Map, More, Onboarding) frozen. Explore explicitly out of scope (blocked on Studio content model). Desktop explicitly deferred (Phase 12). |
| **Studio** | ✓ Complete (editorial workflow) | `v1.0.0` tagged, passed a dedicated production audit (`RELEASE_GATE_REPORT.md`) with 310/310 backend tests passing. Most recent work: destination workflow UI, list-scroll, bulk-action status gating. |
| **Backend (API)** | ✓ Complete | Confirmed in the prior Backend Integration Audit this session: Auth, Database, API layer, Search, Storage, Env config all classified Complete with zero drift found against Consumer's actual calls. |
| **API layer** | ✓ Complete | `/public/*` (5 endpoints + search) and `/editor/*` (full CRUD + workflow) both real, routed, and exercised. |
| **Database** | ✓ Complete | Full SQLAlchemy model set, 13 Alembic migrations, `PublishRevision` snapshot table with optimistic concurrency. **Caveat:** `docs/DATABASE.md` itself was flagged stale in the v1.0.0 audit (missing categories/translations/ETag docs) and was never corrected — treat the doc, not the schema, as the partial item here. |
| **Authentication** | ✓ Complete | Dual-path JWT verification (JWKS + HS256 fallback), full RBAC (`viewer/editor/publisher/admin`), Studio genuinely calls Supabase Auth and attaches tokens. |
| **Storage** | ✓ Complete | Real Supabase Storage upload/delete via `httpx` + service-role key, magic-byte validation, path-traversal sanitization, graceful 503 when unconfigured rather than a crash. |
| **Publishing** | ✓ Complete | Publish action freezes a JSON snapshot (`PublishRevision`), Consumer reads only from the current snapshot via `/public/*` — the "single source of truth" boundary holds in code. |
| **Search** | ✓ Complete | Dedicated server-side `/public/search/venues` endpoint; Consumer's `useSearchVenues` confirmed not to double-filter client-side. |

**Overall: the product is feature-complete and both halves (Studio+API, Consumer) have independently reached their own release-candidate state.** What remains is not features — it's the operational layer around them, which is what the rest of this document covers.

---

## 2. Production Checklist

Status per area, each tagged ✓ Complete / △ Partial / ○ Not Started, with the concrete gap named where relevant.

| Area | Status | Gap (if any) |
|---|---|---|
| **Infrastructure** | △ Partial | Deployment target is a Docker-capable VPS + Supabase (documented in `DEPLOYMENT.md`), no PaaS config anywhere (no `vercel.json`/`render.yaml`/etc.). `api/Dockerfile` and `consumer/Dockerfile` both exist and are production-shaped (non-root user, multi-stage). **No reverse proxy / TLS termination config committed anywhere** — DEPLOYMENT.md assumes one exists but doesn't specify or provide it (nginx/Caddy config absent from the repo). |
| **Security** | △ Partial | See §6 below — CORS, JWT, headers, auth all real; **rate limiting is a confirmed zero** (verified by grep, not just doc claim); CSP/HSTS/COOP/COEP explicitly deferred per `SECURITY.md`. |
| **Monitoring** | ○ Not Started | Zero Sentry/LogTail/Better Stack/UptimeRobot references anywhere in the repo (confirmed by grep). `docs/RUNBOOK.md` states plainly: "no log aggregation or alerting configured for either app." See §3. |
| **Analytics** | ○ Not Started | Confirmed zero analytics SDK anywhere in first-party code (from the Backend Integration Audit this session). See §4. |
| **Performance** | ○ Not Started (no audit yet run) | No Lighthouse/Core Web Vitals baseline exists in the repo. See §5 for the checklist to run before launch. |
| **SEO** | ✓ Complete | `robots.ts`, `sitemap.ts` (static + dynamic venue URLs, degrades gracefully on fetch failure), full `Metadata` with populated OpenGraph/Twitter blocks in `layout.tsx` — genuinely shipped, not a gap. |
| **Backups** | △ Partial | `api/scripts/backup_db.sh` exists and works (gzip dump, fails loud on `pg_dump` error) — but **no schedule exists**; `RUNBOOK.md` explicitly defers scheduling to "your team decides (e.g. a daily cron job)." A manual script isn't a backup strategy until it's scheduled and its restore path is tested. |
| **Disaster Recovery** | △ Partial | `restore_db.sh` exists, requires interactive confirmation (no non-interactive/scripted path — itself a DR gap, since a real incident may need automation). No documented RTO/RPO targets anywhere. |
| **Deployment** | △ Partial | Manual, command-level process fully documented (`DEPLOYMENT.md`, `RUNBOOK.md`); **CI has zero deploy step** — build/lint/test only. Every deploy today is a human running commands by hand. |
| **Environment Variables** | ✓ Complete | Every var documented in `.env.example` is actually read by `Settings` (`api/app/core/config.py`), no drift. Consumer's env surface is minimal and consistent. |
| **Secrets** | ✓ Complete (handling) / △ Partial (rotation) | `.env`/`.env.*` correctly gitignored; service-role key and JWT secret never exposed to frontend. No documented rotation procedure or secret-manager integration (plain `.env` files on the host) — acceptable at current scale, worth flagging before scaling the team. |
| **Rate Limiting** | ○ Not Started | Confirmed via grep: no `slowapi`, no `fastapi-limiter`, no custom middleware. Explicitly named as a known gap in `SECURITY.md` and `RELEASE_GATE_REPORT.md` §6 already — not a new finding, but still unresolved. |
| **Logging** | △ Partial | Structured-enough application logging exists (`logger.exception` on unhandled errors and auth failures, never logs tokens), but it's **stdout-only** — no aggregation, no retention policy, no searchable log store. |
| **Health Checks** | △ Partial | `GET /health` on the API is real (checks DB connectivity, returns 503 on failure). **Consumer and Studio have no health endpoint at all** — `DEPLOYMENT.md` itself verifies Consumer health via a bare `curl -f /`, not a purpose-built check. |
| **Error Reporting** | ○ Not Started | No Sentry or equivalent. The API's global exception handler logs tracebacks server-side but nothing forwards them anywhere actionable; Consumer has no client-side error boundary/reporting either. |
| **CI/CD** | △ Partial (CI real, CD absent) | `ci.yml` runs real work: backend `pytest` + `pip-audit` (blocking), datalab-next `tsc`+lint+test+build+`npm audit` (audit non-blocking), consumer lint+build+`npm audit` (non-blocking). **Consumer has no test step in CI at all** — lint+build only, no `npm test`. **No deploy job exists in CI for any app.** |
| **Release Process** | ✓ Complete (documented) | `RELEASE_CHECKLIST.md` is a reusable, non-version-pinned pre-flight list; this session already exercised a real version of it for `mobile-2027-rc1`. |
| **Rollback Process** | ✓ Complete (documented, manual) | `RUNBOOK.md` covers per-component rollback (API image retag, `alembic downgrade -1`, Consumer rebuild-from-source, full backup restore as last resort) — real, but entirely manual, no automation or one-command rollback. |

---

## 3. Monitoring

> **Revised 2026-08-06 — scope change.** Operational monitoring surfaces belong in **Studio**, not Consumer. Consumer stays lightweight: only the minimal client-side concerns (error reporting SDK, analytics SDK, performance metrics) live there — never a dashboard, never an ops-facing health route of its own. The original version of this section proposed a dedicated Consumer health endpoint; that proposal is **withdrawn**. Full detail: `docs/STUDIO_OPERATIONS_DASHBOARD.md`.

**Current state: zero observability tooling exists anywhere in the repo.** This is the single largest gap standing between "feature-complete" and "production-ready" — not because anything is broken, but because if something breaks in production today, the team would find out from a user complaint, not a system.

### Recommendations, by priority

| Tool | Priority | Why |
|---|---|---|
| **API `/health` → uptime monitor** | **Required** | The endpoint already exists (`api/app/api/routes/system.py`) — it just isn't being polled by anything external. This is the cheapest, highest-leverage fix available: wiring an existing endpoint to an external check, zero new code. |
| **UptimeRobot** (or equivalent) | **Required** | Poll API `/health` on an interval, alert on downtime. Pure ops configuration, no code change. Consumer is **not** independently health-checked by this tool — its correctness is verified operationally through Studio's new Operations dashboard (`STUDIO_OPERATIONS_DASHBOARD.md`), not a second public health route. |
| **Sentry** (or equivalent error tracker) | **Required** | The API already has a global exception handler (`main.py:63-69`) that logs full tracebacks — it's one integration away from also *reporting* them. Consumer needs only the client-side error-reporting SDK itself (a minimal concern, per the revised scope) — not a dashboard to view those errors, which belongs in Sentry's own UI or a Studio summary card, not a bespoke Consumer-side surface. |
| **Structured logging → a log store** (Better Stack / Logtail / equivalent) | **Optional at launch, Required soon after** | Current logging is real but stdout-only with no retention — fine for a single-VPS manual `docker logs` check today, but doesn't scale past the first real incident. Not a blocker for initial launch given low expected traffic, but should follow within the first post-launch sprint. |
| **Studio Production Operations dashboard** | **Required** (new, replaces the withdrawn Consumer health-route item) | Aggregates API/DB/Storage health, version, environment, and publishing status into one authenticated, admin-gated view inside Studio — the correct home for operational visibility. Full plan: `docs/STUDIO_OPERATIONS_DASHBOARD.md`. |
| **Full APM / distributed tracing** | **Future** | Not justified at current scale (401 venues, pre-launch traffic). Revisit once real production load exists. |

**Nothing here requires implementation right now per this phase's rules** — this section exists to be acted on once planning is approved, not executed today.

---

## 4. Analytics

### Recommendation: **PostHog**

| Option | Verdict |
|---|---|
| **PostHog** | **Recommended.** Self-hostable (fits the existing VPS-centric infra model already established for the API) or usable via their cloud free tier with no code-path difference — either way, no new hosting paradigm is introduced. Product analytics (funnels, session replay, feature flags) is a closer fit to what a young consumer product actually needs (understanding *how* people use Search/Map/Saved) than GA4's page-view-centric model. Client-side SDK is small and framework-agnostic — drops into `consumer/app/layout.tsx` with the same low-friction shape as the `Metadata` block already there. |
| **GA4** | Not recommended as primary. Optimized for marketing/acquisition reporting, not product/funnel analysis; its event model is a worse fit for "did this visitor complete Onboarding then Save a venue" than PostHog's. Could still be added later purely for SEO/ads attribution without conflicting with PostHog — not mutually exclusive, just not the primary tool. |
| **Firebase Analytics** | Not recommended. Pulls in the broader Firebase/Google Cloud ecosystem for a project that has deliberately stayed on Supabase/Postgres+FastAPI with no Google Cloud dependency anywhere today — adopting it here would be the first crack in an otherwise consistent "one cloud vendor for backend infra" posture. |

### Events to Track (MVP set)

Named after the actual screens/interactions this migration built, not generic e-commerce events:

| Event | Fires when |
|---|---|
| `Home Viewed` | Home screen mounts |
| `Search Started` | A query is typed/submitted on `/search` |
| `Venue Opened` | Navigating into `/venues/[id]` (from any entry point — Home rail, Search, Map, Saved) |
| `Venue Saved` | `useSaved().toggle()` called with a save (not unsave) |
| `Venue Shared` | `handleShare()` fires successfully (either Web Share completes or clipboard copy succeeds — the exact bug class fixed twice this session is also the natural place to hook a `Venue Shared` event) |
| `Destination Opened` | Navigating into a destination from Home's Explore Destinations rail |
| `Map Used` | `/map` screen mounts (optionally split into `Map Marker Tapped` / `Map Filter Changed` if funnel-level detail is wanted later) |
| `Onboarding Completed` | `useOnboardingSeen().markSeen()` called (fires identically whether via Skip or Get Started — worth a `method: "skip" | "completed"` property to distinguish) |

**Priority split:** all eight are MVP — none require backend changes, all correspond to existing, already-implemented interaction points, so the marginal cost of instrumenting them is client-side-only. No event here requires a new feature or a new API contract.

---

## 5. Performance Audit Checklist

No baseline exists yet — this is the checklist to run once, before launch, and then periodically after.

- [ ] **Lighthouse** (mobile profile, matching the app's mobile-only scope) — run against Home, Search, Venue Details, and Map (the four heaviest screens: Map for Mapbox GL's bundle weight, the others for image-heavy card rails).
- [ ] **Core Web Vitals** — establish a real baseline; none exists today.
  - [ ] **LCP** — Home's hero image-carrying cards are the likely largest contentful element; verify `next/image` sizing/priority hints are correct on above-the-fold cards.
  - [ ] **CLS** — check the skeleton→content transition on every screen (Home rails, Search results, Map marker load) for layout shift, since every screen in this migration uses `Skeleton` placeholders that must match final content dimensions exactly.
  - [ ] **INP** — Map screen is the highest-risk surface (Mapbox GL + custom DOM marker factories, not React-rendered) — verify marker tap→Liquid-Morph-Preview responsiveness under real device conditions, not just desktop dev tools.
- [ ] **Bundle analysis** (`next build` output / `@next/bundle-analyzer`) — Mapbox GL is dynamically imported (`ssr: false`) specifically to keep it off every other route's payload (confirmed in `MapClient.tsx`); verify that isolation is actually holding and no other route accidentally pulls it in transitively.
- [ ] **Image optimization** — confirm `next/image` is used consistently (it is, per the card components reviewed this session) and that Supabase Storage-served images have reasonable dimensions at source, since there's no CDN/transform layer on the backend (confirmed in the Backend Integration Audit) — all resizing responsibility sits entirely on the Next.js image pipeline.
- [ ] **Caching** — verify TanStack Query's cache behavior is tuned sensibly per data type (venue/destination data is near-static within a publish revision; a future weather integration, per `BEACH_WEATHER_SPEC.md`, would need a deliberately different short-`staleTime` policy — not relevant yet, but worth setting the precedent correctly now before that lands).
- [ ] **Lazy loading** — confirm below-the-fold rails (Food Picks, Nightlife, Upcoming Events on Home) don't block initial paint; `CardCarousel`'s horizontal-scroll pattern should already help here, but hasn't been measured.

---

## 6. Security Readiness Review

| Area | Status | Detail |
|---|---|---|
| **Authentication** | ✓ Ready | Dual-path JWT (JWKS + HS256 fallback), fail-closed, auth-failure logging without token leakage. |
| **Authorization** | ✓ Ready | Full RBAC (`viewer/editor/publisher/admin`) via `require_permission()`, 403 on violation. |
| **Secrets** | ✓ Ready (current scale) | `.env`/`.env.*` gitignored correctly; service-role key and JWT secret never reach the frontend. No secret-manager/rotation process — acceptable today, a real gap once the team or deployment surface grows. |
| **Environment Variables** | ✓ Ready | `Settings` fails fast on missing/empty required vars (`min_length=1` on `database_url`/`supabase_jwt_secret`) rather than failing confusingly downstream. |
| **CORS** | ✓ Ready | Explicit origin allowlist, no wildcard, credentials off, scoped methods/headers — correctly restrictive. |
| **Headers** | △ Partial | 5 real headers set today (`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`, `API-Version`) via a hand-rolled middleware, plus Consumer's own `next.config.ts` `headers()`. **CSP, HSTS, COOP, COEP, CORP are explicitly deferred** per `SECURITY.md` — not silently missing, but not present either. |
| **JWT** | ✓ Ready | Asymmetric (JWKS) primary path with HS256 fallback for legacy projects, correctly documented as backend never calling Supabase Auth's API directly — only verifying tokens the frontend already obtained. |
| **Storage Permissions** | ✓ Ready | Uploads go through the backend using the service-role key server-side only; magic-byte content-type validation and filename sanitization against path traversal both real. |
| **RLS (Row-Level Security)** | ○ Not Applicable / Not Implemented | The backend connects via direct Postgres (SQLAlchemy, `postgresql+psycopg://`), not the Supabase client — confirmed in the Backend Integration Audit. No RLS policies are configured at the Postgres level (confirmed: zero mentions in `docs/DATABASE.md`). This means **all access control lives entirely in the FastAPI application layer (the RBAC system above), with none at the database layer as defense-in-depth.** Worth an explicit decision: is application-layer-only auth an accepted risk permanently, or should RLS be added as a second layer before launch? Not a silent gap — a decision point. |
| **Public APIs** | ✓ Ready | `/public/*` is correctly unauthenticated by design (read-only, snapshot-backed), with rate limiting as the one meaningful hardening step still missing (see below) — an unauthenticated, unrated public API is the most exposed surface in the whole system. |

**Single most important open security item: rate limiting.** Everything else on this list is either done or an explicit, documented, low-urgency deferral (CSP/HSTS/RLS). Rate limiting is the one gap that directly affects the most exposed, least-protected surface (`/public/*`, no auth by design) and has zero mitigation today.

---

## 7. Deployment

| Stage | Current state |
|---|---|
| **Development** | Each app run locally (`uvicorn`/`npm run dev`/`vite dev`) against either a local Postgres or the real Supabase dev project — `TESTING.md` confirms tests run against the real Supabase project, not a local DB, with strict serial-execution requirements (no `pytest-xdist`) due to a previously-real `StaleDataError` under concurrent runs. |
| **Preview** | **Does not exist as a concept today.** No PR-preview-deploy tooling (no Vercel-style ephemeral environments) — CI only lints/tests/builds, never deploys anything, preview or otherwise. |
| **Production** | Single VPS target, Docker for API and Consumer (both have real, production-shaped Dockerfiles — non-root users, multi-stage builds), Studio as a static build served by the same or a separate static host. Supabase for Postgres + Storage + Auth (JWKS/token verification only). Deployment order per `DEPLOYMENT.md`: Database → Migration → API → Studio+Consumer → Health Check — entirely manual, no automation. |
| **Rollback** | Documented, real, manual: API image retag+redeploy, `alembic downgrade -1`, Consumer rebuild-from-a-prior-commit, full DB restore as last resort. No one-command or automated rollback path exists. |
| **Backup** | `backup_db.sh` exists and is correct (fails loud, no partial-file artifacts) but is **unscheduled** — a real backup strategy requires this to run on a cron/timer, which is explicitly left as a team decision not yet made. |
| **Migration** | Alembic, applied as an explicit manual step (`alembic upgrade head`), not baked into any container's startup command — meaning a deploy that forgets this step ships old schema against new code, a real and currently-unguarded failure mode. |

**Note on a real doc/code drift found during this audit:** `DEPLOYMENT.md`, `RUNBOOK.md`, and `RELEASE_CHECKLIST.md` all currently state that no Dockerfile exists for Consumer — but `consumer/Dockerfile` does exist today (multi-stage, non-root, correctly bakes `NEXT_PUBLIC_API_BASE_URL` in at build time per Next.js's static-inlining constraint). This should be verified with whoever added it (new and untested, vs. just undocumented) before relying on it for the actual production deploy — flagging here rather than silently trusting either the doc or the file.

---

## 8. Launch Checklist

A real, actionable checklist — not a template. Items are ordered roughly by dependency (earlier items block later ones).

- ☐ RC Approved — **Consumer:** `mobile-2027-rc1` tagged and pushed (done this session). **Studio/API:** `v1.0.0` gate-reviewed (done, historical).
- ☐ Rate limiting added to `/public/*` (the single highest-priority open item from §6)
- ☐ Studio Production Operations dashboard built (`docs/STUDIO_OPERATIONS_DASHBOARD.md`) — the operational visibility surface, replacing the withdrawn Consumer health-route item
- ☐ Monitoring enabled — UptimeRobot (or equivalent) polling API `/health`
- ☐ Error reporting enabled — Sentry (or equivalent) wired into the API's exception handler and Consumer's client-side error-reporting SDK (SDK only — no Consumer-side dashboard)
- ☐ Analytics enabled — PostHog wired, all 8 MVP events (§4) instrumented and verified firing in a staging pass
- ☐ Database backup scheduled (cron/timer around the existing `backup_db.sh`) — not just script-exists, actually running on a schedule
- ☐ Restore procedure tested at least once against a real (non-production) database — an untested restore script is not a verified DR plan
- ☐ Environment variables confirmed set correctly per environment (`ENVIRONMENT=production`, `ALLOWED_ORIGINS` listing only real deployed origins, no dev defaults leaking through)
- ☐ Domain + DNS pointed at the production VPS
- ☐ SSL/TLS configured (reverse proxy — nginx/Caddy config needs to actually exist; currently assumed, not present in the repo)
- ☐ `robots.txt` verified against production `NEXT_PUBLIC_SITE_URL` (already implemented, just needs a final check against the real domain, not the `https://sahelspot.com` default)
- ☐ `sitemap.xml` verified generating real venue URLs against the production API, not falling back to static-only
- ☐ OpenGraph/Twitter card tags spot-checked on a real venue page (implementation exists; verify the venue-specific override actually renders correctly on a live URL, e.g. via a social-preview debugger)
- ☐ Production build run and smoke-tested (`next build` + `next start`, not `next dev`) for Consumer; Docker image built and run for both API and Consumer
- ☐ Alembic migrations applied to the production database (`alembic upgrade head`) — before the new API image starts serving traffic, not after
- ☐ Smoke test — walk all 7 frozen Consumer screens (Home, Saved, Venue Details, Search, Map, More, Onboarding) plus Studio's core editorial flow against the real production API, not staging
- ☐ Production validation — confirm `docs_enabled` is correctly `False` (no `/docs`/`/redoc`/`/openapi.json` exposed), confirm security headers present on a real response, confirm CORS rejects an unlisted origin

---

## 9. Post-Launch Priorities

In recommended order, based on what's already specified vs. what's still open:

1. **Observability hardening** — move from "monitoring exists" (launch-checklist bar) to "monitoring is actually useful": alert routing/on-call, log retention policy, a real incident-response runbook (currently absent — `RUNBOOK.md` has rollback steps but no escalation process).
2. **Beach Weather** (Home Hero Widget + full screen) — the most concretely planned next feature; full product spec already written and approved (`docs/consumer/BEACH_WEATHER_SPEC.md`), blocked only on a weather-data provider decision and the Sea Flag 3-state component decision. Closest to shippable of everything in this list.
3. **Explore** — blocked on the Studio collections content model (a Studio/backend-side sprint, not a Consumer one) — becomes unblocked independently of anything else here.
4. **Desktop adaptation** (Phase 12) — explicitly gated on mobile being "confirmed feature-complete and stable" (now true) rather than a fixed date; same tokens/components, no new visual vocabulary permitted per the Design Freeze.
5. **CI/CD → real CD** — add an actual deploy job to `ci.yml` (currently build/lint/test only), closing the gap between "CI is real" and "deployment is still 100% manual."
6. **Events, Notifications, Booking, AI Recommendations** — none of these have any specification work done yet in this repo (unlike Beach Weather); they're reasonable long-term product directions but would each need their own planning pass before implementation, same discipline used for Beach Weather.

---

## Summary

SahelSpot's **product** is done — Consumer and Studio+API have each independently reached a real, verified release-candidate state, and the Backend Integration Audit conducted earlier this session found no drift between what Consumer expects and what the backend serves. What stands between here and a safe production launch is entirely **operational**: no rate limiting on a public unauthenticated API, no error tracking, no uptime monitoring, no analytics, no scheduled backups, no CI-driven deploy, and a documentation set (`DEPLOYMENT.md`/`RUNBOOK.md`) that's already drifted from reality in at least one place (the Consumer Dockerfile). None of these are large engineering efforts individually — most are single, well-scoped integrations — but shipping without them means the team would be flying blind on day one of real traffic.

**No code was modified, no commits were created, and no features were implemented in the course of producing this document, per Phase 2's rules.**
