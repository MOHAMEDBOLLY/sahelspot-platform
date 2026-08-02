# SahelSpot Platform — Project Status

Last updated: 2026-08-02 · Current tag: **`v1.5.0-consumer-mobile-rc1`** · Branch: `main`

This document is the single point-in-time snapshot of where the platform stands. For
day-to-day detail, follow the links in **Documentation references** below rather than
duplicating them here — this file summarizes, it doesn't replace them.

---

## Architecture

Three applications, one database, one publishing boundary:

```
SahelSpot Studio (editorial)          Consumer Website (public)
  datalab-next/  — React/Vite/TS        consumer/ — Next.js App Router/TS
  api/           — FastAPI/SQLAlchemy
        │                                       │
        ▼                                       ▼
   /editor/*  (auth-gated CRUD,           /public/*  (unauthenticated,
   workflow, publish action)              snapshot-backed reads only)
        │                                       ▲
        └──────────► publish revision ──────────┘
                    (frozen JSON snapshot,
                     Postgres/Supabase)
```

- **Single backend, single source of truth:** the Consumer Website consumes only the
  Public API. No Supabase, no direct database access, no parallel data source — approved
  architecture decision, unchanged since Consumer's kickoff.
- **No user accounts in Consumer v1.** Saved places and recent searches are device-local
  (`localStorage`), isolated behind a `SavedRepository` interface so a future authenticated
  implementation can replace the storage without touching the UI layer.
- **Consumer data flow:** Public API → API Client → DTO → Mapper → Domain Model → (View
  Model, only where a screen needs one) → UI Components. See
  `docs/consumer/ARCHITECTURE.md` §3 for the full contract.
- **Visual source of truth for Consumer:** the Google Stitch export (four canonical
  screens + a written spec for the remaining five). No screen was redesigned; deviations
  from Stitch are enumerated in `docs/consumer/DESIGN_SYSTEM.md` §12.

---

## Completed phases — Consumer Website

| Phase | Scope | Status |
|---|---|---|
| 0 | Foundation, design tokens, routing shell, primitives | ✅ |
| 1 | Layout system and navigation | ✅ |
| 2 | Component library | ✅ |
| 3 | Data layer (API client, DTOs, mappers, domain models, hooks) | ✅ |
| 4 | Home | ✅ |
| 5 | Interactive Map (Mapbox, isolated module) | ✅ |
| 6 | Venue Details | ✅ |
| 7 | Search | ✅ |
| 9 | Saved · More · Splash · Onboarding | ✅ |
| 10 | Motion (Framer Motion, audited against existing CSS first) | ✅ |
| — | Real-dataset regression verification (publish revision 1071) | ✅ |
| 11 | Accessibility, SEO metadata, performance, QA | ✅ |

Two real defects were found and fixed during implementation, not just theoretical risks:
a category-taxonomy mismatch that silently mis-colored 51% of map markers (fixed in the
domain mapper), and two failing colour-contrast pairs plus five controls with no
accessible name (both fixed and re-verified against the live accessibility tree). Details
in `docs/consumer/API_REQUIREMENTS.md` §9 and `docs/consumer/ROADMAP.md`'s Phase 11 entry.

**Studio** — publish workflow is operational; most recent work is destination workflow UI,
list-scroll, and bulk-action status gating (`datalab-next/`).

---

## Remaining phases

| Phase | Scope | Blocked by |
|---|---|---|
| 8 | Explore | Studio collections content model — a Studio-side sprint, not a Consumer one. See `docs/consumer/API_REQUIREMENTS.md` §2. |
| 12 | Desktop adaptation | Gated on mobile being confirmed feature-complete and stable, not on a fixed schedule. No new visual vocabulary — same tokens/components, per `docs/consumer/DESIGN_SYSTEM.md` §3. |
| — | Final QA | Post-Desktop |
| — | Release | Post-final-QA |

Open product/UX decisions (not blockers) are tracked in `docs/consumer/ROADMAP.md`'s
"Open decisions" section — e.g. whether the mood grid/map markers should grow beyond
Stitch's 5 categories to cover Studio's real 11, and whether first-time visitors should be
redirected into Onboarding.

---

## Current published dataset

| | |
|---|---|
| Publish revision | **1071** |
| Destinations | **25** |
| Venues | **401** |

Verified directly against the live Public API (`/public/venues`, `/public/destinations`)
during Consumer's real-data regression pass — see `docs/consumer/ROADMAP.md`'s
"Real-data verification" section for what was checked and what was found.

---

## Current git state

| | |
|---|---|
| Tag | `v1.5.0-consumer-mobile-rc1` |
| `main` HEAD | Merge of `claude/sahelspot-consumer-website-38f02b` into `main` |
| Consumer branch | `claude/sahelspot-consumer-website-38f02b` (merged, still present) |

### Branch strategy

- `main` — integration branch; always expected to build and pass typecheck/lint for every
  app in the monorepo (`api/`, `datalab-next/`, `consumer/`).
- Feature work happens on `claude/*` branches, one per initiative, merged into `main` once
  verified — not developed directly on `main`.
- Tags mark stable checkpoints worth returning to (release candidates, pre-Desktop
  baseline) — not every merge is tagged, only ones like this one.
- `consumer/` and `api/`/`datalab-next/` are developed independently; the only integration
  point is the Public API contract (`docs/API.md`, `docs/consumer/API_REQUIREMENTS.md`),
  never shared code or a shared branch.

---

## Documentation references

**Consumer Website** (`docs/consumer/`):
- [`ARCHITECTURE.md`](docs/consumer/ARCHITECTURE.md) — folder structure, data flow, domain models, state, config
- [`DESIGN_TOKENS.md`](docs/consumer/DESIGN_TOKENS.md) — colour/type/spacing tokens, verified against the Stitch export
- [`DESIGN_SYSTEM.md`](docs/consumer/DESIGN_SYSTEM.md) — composition rules, layout shells, known deviations from Stitch
- [`COMPONENT_INVENTORY.md`](docs/consumer/COMPONENT_INVENTORY.md) — every component, its props, and its Stitch source
- [`SCREEN_ANALYSIS.md`](docs/consumer/SCREEN_ANALYSIS.md) — per-screen breakdown against the export/spec
- [`STITCH_SOURCE.md`](docs/consumer/STITCH_SOURCE.md) — export provenance, canonical-screen identification, contradictions found
- [`API_REQUIREMENTS.md`](docs/consumer/API_REQUIREMENTS.md) — every Public API field the Consumer needs but doesn't have yet, with priority
- [`ROADMAP.md`](docs/consumer/ROADMAP.md) — phased plan, exit criteria per phase, open decisions

**Platform-wide** (`docs/`):
- [`ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`API.md`](docs/API.md) · [`DATABASE.md`](docs/DATABASE.md) · [`PRODUCT.md`](docs/PRODUCT.md)
- [`DEPLOYMENT.md`](docs/DEPLOYMENT.md) · [`RUNBOOK.md`](docs/RUNBOOK.md) · [`SECURITY.md`](docs/SECURITY.md) · [`TESTING.md`](docs/TESTING.md)

**Repo root:** [`README.md`](README.md) for setup instructions per app.
