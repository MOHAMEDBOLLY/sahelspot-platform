# Release Notes — v1.0.0

> **Naming note:** the tag `v1.0.0` already exists in this repository
> and points to an older commit (`15989eb6`, 35 commits behind this
> release's `HEAD`) — see `docs/FINAL_RELEASE_SUMMARY.md` and the git
> verification below for the full detail. This document is named
> `RELEASE_NOTES_v1.0.0.md` as requested, but the codebase state it
> describes should be tagged as a **new version** (e.g. `v1.1.0`), not
> a re-use or move of the existing `v1.0.0` tag. No tag was created or
> moved as part of producing this document.

**Commit:** `c77860218bb4f724e8cf022f47b4d5bf995d50eb`
**Date:** 2026-07-28

---

## Executive Summary

This release delivers the full editorial platform rebuild described in
`docs/PLATFORM_SPEC_v1.0_FROZEN.md`: a corrected, extended database
schema (Phase 1), a backend API that fully implements the frozen
contract — optimistic concurrency, referential closure, i18n, reject
workflows, export, and statistics (Phase 2) — and a Studio frontend
that fully consumes that contract end-to-end, including the
concurrency protocol the previous frontend had no support for at all
(Phase 3). A full production readiness audit (git, backend, frontend,
API contract, database, security, performance, documentation, code
quality) found no blocking issues.

---

## Completed Phases

| Phase | Scope | Status |
|---|---|---|
| **Phase 1** — Schema & Database | Category/region taxonomy correction, optimistic-concurrency `version` columns, `translations`/`legacy_geo` JSONB columns, beach-details shape constraint, required indexes | ✅ Complete |
| **Phase 2** — Backend API | Venue create, media delete, destination workflow parity, reject workflow, referential-closure enforcement, ETag/If-Match concurrency, stats & export endpoints, unified bulk endpoint, API versioning header | ✅ Complete |
| **Phase 3** — Studio (Frontend) | Publish/rollback controls, live dashboard stats, venue create + beach fields, export & real media delete, reject reason UI, concurrency client integration, minimal translations editing | ✅ Complete |
| **Release Gate** — Final Production Audit | Full audit across 10 categories; verdict READY FOR PRODUCTION | ✅ Complete |

See `docs/PHASE1_COMPLETION_REPORT.md`, `docs/PHASE2_COMPLETION_REPORT.md`,
`docs/PHASE3_COMPLETION_REPORT.md`, and `docs/RELEASE_GATE_REPORT.md`
for the full detail behind each line below.

---

## Implemented Features

- Full venue and destination editorial lifecycle: draft → review →
  approved/rejected, with a reason required on reject.
- Venue creation from Studio, including conditional beach-specific
  fields (`type`, `publicAccess`) shown only for `category === 'Beach'`.
- Destination workflow parity with venues (submit-for-review, approve,
  reject, boundary write, live per-destination stats).
- Publish and Republish, both reachable from Studio, with
  `excluded_venue_count` surfaced whenever the referential-closure gate
  excludes an approved venue whose destination isn't itself approved.
- CSV/JSON export for both venues and destinations.
- Real image deletion (storage file removed, not just the reference
  cleared) for venue cover/gallery images.
- Optimistic concurrency end-to-end: every entity edit round-trips a
  `version`, sent back as `If-Match`; a real conflict produces a `409`
  with a clear "reload" recovery path instead of a silent failure or
  data loss.
- Minimal i18n: an optional Arabic name field (`translations.ar.name`)
  on both venues and destinations.
- Live platform statistics on the Studio dashboard.

---

## Backend Highlights

- 13-value venue category taxonomy and 8-value destination region
  taxonomy, both enforced by database `CHECK` constraints and validated
  at the API layer.
- Optimistic concurrency via an integer `version` column plus
  `ETag`/`If-Match` (not a bare timestamp check), scoped to the two
  entities that need it.
- Referential-closure enforcement for publishing: an approve-time gate
  plus a publish-time join filter, with graceful per-venue exclusion
  and activity logging rather than a whole-publish failure.
- A single unified bulk-update endpoint (`PATCH /editor/venues/bulk`)
  replacing two narrower ones, accepting either or both of
  `category`/`destination_id` in one call.
- Dual-path JWT verification (Supabase JWKS/ES256 and legacy HS256),
  enforced at the router level for every editorial route in addition to
  each route's own permission check.
- File upload hardening: magic-byte content-type sniffing, a 5 MB size
  cap enforced both early and after read, and filename sanitization.

## Frontend Highlights

- Studio now fully consumes the backend's concurrency contract — every
  entity `PATCH` sends `If-Match`, and a `409 version_conflict` is
  handled explicitly rather than failing silently.
- Publish, Export, Reject, and Venue-create controls are all now
  reachable from the UI, closing every remaining gap between what the
  backend could do and what an editor could actually trigger.
- A top-level error boundary and a consistent `ApiError`/structured-
  error-message path across every mutation.
- Zero dead code, TODO/FIXME/HACK markers, or debug statements in the
  shipped frontend.

## Database Changes

- `venues.category` extended from 9 to 13 values (`Resort`, `Spa`,
  `Beach Club`, `Activity` added).
- `destinations.region` constrained to an explicit 8-value `CHECK`
  (previously unconstrained).
- `venues.version` / `destinations.version` (`integer`, default `1`) —
  optimistic concurrency.
- `venues.translations` / `destinations.translations` (`jsonb`,
  nullable) — i18n.
- `venues.legacy_geo` (`jsonb`, nullable) — provenance for
  legacy-imported geographic data.
- `ck_venues_beach_details_shape` — a `Beach` venue must carry
  `beach_details` with both `type` and `publicAccess`; a non-`Beach`
  venue must not carry `beach_details` at all.
- Indexes added: `ix_venues_category`, `ix_venues_status`,
  `ix_venues_destination_id_status`, `ix_destinations_status`,
  `ix_publish_revisions_published_at`, and a `pg_trgm` GIN index on
  `lower(venues.name)` for substring search.
- Ten migrations total (`0001`–`0010`), verified via a clean
  `alembic upgrade head` from empty on a fresh Postgres 16 instance.

## Security Improvements

- `translations` was previously readable but silently write-blocked on
  both entities (a Phase 2 schema omission found and fixed during
  Phase 3) — now correctly writable end-to-end.
- Removed two orphaned bulk-update endpoints
  (`bulk/category`, `bulk/destination`), replaced by one unified,
  fully-tested route.
- `expose_headers: ["ETag"]` and a scoped (non-wildcard)
  `allow_headers` list added to CORS, required for the concurrency
  protocol to function from a browser at all.
- Standard security response headers
  (`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`,
  `X-Frame-Options`, `API-Version`) applied to every response.

---

## Known Non-Blocking Limitations

(Full detail in `docs/RELEASE_GATE_REPORT.md`, section 10.)

1. `activity_log.timestamp`'s index exists in the database (created by
   an early migration) but isn't declared in the SQLAlchemy model — a
   future `alembic revision --autogenerate` could propose dropping it.
   No functional impact today.
2. No rate limiting is implemented anywhere on the API. Mitigated today
   by JWT authentication, RBAC, and the admin surface sitting behind a
   Basic-Auth-gated subdomain; should be added before traffic or public
   exposure increases meaningfully.
3. `docs/DATABASE.md` and `docs/API.md` were not updated across Phases
   1–3 and no longer reflect the shipped schema/contract (the frozen
   spec and phase completion reports are accurate and were the actual
   source of truth throughout).
4. A bounded (≤100 items), non-batched loop in the three bulk
   endpoints, and an un-split ~573 KB frontend production bundle — both
   pre-existing performance follow-ups, neither a correctness issue.
5. No browser/live-session UI verification was performed during Phase
   3 (no test credentials were available in that session) — all
   frontend verification was via type-check, lint, unit tests, and a
   production build, not an authenticated manual pass.

None of the above are release-blocking; see `docs/RELEASE_GATE_REPORT.md`
for the full reasoning.

---

## Deployment Requirements

- **API:** `DATABASE_URL`, `SUPABASE_JWT_SECRET`, `ALLOWED_ORIGINS`
  (must list the real deployed Studio/Consumer origins), `ENVIRONMENT`
  explicitly set to `production` (unset leaves `/docs`/`/redoc`/
  `/openapi.json` publicly browsable). `SUPABASE_URL` +
  `SUPABASE_SERVICE_ROLE_KEY` if media upload is used.
- **Studio:** `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY`, all set before `npm run build` (inlined at
  build time).
- **Consumer:** `NEXT_PUBLIC_API_BASE_URL`, set before `npm run build`
  (also inlined at build time — setting it only before `npm run start`
  has no effect).
- Run `alembic upgrade head` against the target database before
  deploying the new API image.
- See `docs/DEPLOYMENT.md` and `docs/RELEASE_CHECKLIST.md` for the full
  step-by-step deployment sequence.

## Upgrade Notes

- **Breaking for any existing API client:** `PATCH /editor/venues/{id}`
  and `PATCH /editor/destinations/{id}` now require an `If-Match`
  header (the entity's current `version`); a request without one
  receives `428 Precondition Required`. Studio itself was updated in
  this release to always send it — any other API consumer must be
  updated before this deploys, or its writes will start failing.
- **Breaking:** `PATCH /editor/venues/bulk/category` and
  `PATCH /editor/venues/bulk/destination` no longer exist — use the
  unified `PATCH /editor/venues/bulk` (accepts either or both of
  `category`/`destination_id`).
- Migrations `0001`–`0010` must be applied in order; there is no
  destructive migration in this range (no column drops, no data
  deletion) — see each migration file's own downgrade for the exact
  reverse operation.
- No manual data backfill is required — every new column
  (`version`, `translations`, `legacy_geo`) is nullable or has a safe
  default (`version` defaults to `1`).

## Rollback Notes

- **API:** redeploy the previous image tag; then
  `alembic downgrade <previous_revision>` if a schema rollback is also
  required (each migration in `0001`–`0010` has a tested downgrade —
  see `docs/PHASE1_COMPLETION_REPORT.md`'s clean-slate verification
  discipline). Rolling back the API *without* rolling back the schema
  is safe in the downgrade direction only if the previous API version
  never reads the new columns — confirm against the specific previous
  tag before doing this.
- **Studio/Consumer:** redeploy the previous build artifact
  (`dist/`/`.next`) or previous container image; both are static/
  build-time-configured, so no runtime state to reconcile.
- **Database:** take a fresh backup (`api/scripts/backup_db.sh`)
  immediately before deploying this release, per
  `docs/RELEASE_CHECKLIST.md`'s existing pre-deployment step — this is
  the fastest rollback path if a migration-level rollback proves
  insufficient.
