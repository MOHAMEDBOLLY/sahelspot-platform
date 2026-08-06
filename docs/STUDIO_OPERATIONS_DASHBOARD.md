# Studio Production Operations Dashboard — Implementation Plan

**Status: Planning only. No code implemented.** This document exists to be reviewed and approved before any implementation begins, per the Phase 3 scope change: **all operational monitoring belongs in Studio, not Consumer.** Consumer stays lightweight — it will only ever carry the minimal client-side concerns (error reporting SDK, analytics SDK, performance metrics) needed for its own health, never an operations surface of its own.

The **Dashboard Philosophy**, **Read-Only Operations Dashboard**, **System Information Card**, and **Feature Flags Card** sections below are now **approved, permanent architectural decisions** — not proposals awaiting sign-off. Everything else in this document (specific endpoint choices, priority ordering, sequencing) remains an implementation plan pending approval, per the rest of Phase 3's process.

This plan was built from a direct, read-only audit of `datalab-next/` (Studio) and `api/` — not assumptions. Every "Existing" claim below is cited; nothing is proposed for building that already exists.

---

## Why Studio, Not Consumer

Studio is already the authenticated, role-gated, internal control surface for SahelSpot — it has a router, a sidebar, an `AppShell` layout, an established `features/<name>/{api,types,use*,Panel}.tsx` convention, and a real RBAC system (`viewer/editor/publisher/admin`) enforced both client-side (UI gating) and server-side (`require_permission`, the actual security boundary). An operations dashboard is exactly the kind of internal, privileged surface Studio already exists to host. Building it in Consumer — a public, unauthenticated, mobile-only application whose entire design freeze is oriented around venue discovery — would mean either exposing operational data publicly or bolting an ad-hoc auth/permission system onto an app that has neither today. Studio already has both.

---

# Dashboard Philosophy

**Status: Approved architectural decision, permanent.**

The Studio Operations Dashboard is an operational overview.

Its responsibility is **visibility**.

Not management.
Not administration.
Not editing.

The dashboard exists to answer one question: **"What is the current state of the platform?"**

It is the Mission Control of SahelSpot — a single place to look to understand whether everything is working, not a place to make things happen. Every design decision in this document follows from that one sentence: if a proposed card or feature would let someone *change* platform state rather than *observe* it, it does not belong on this dashboard, no matter how convenient that might seem.

---

# Read-Only Operations Dashboard

**Status: Approved architectural decision, permanent.**

The Operations Dashboard is **strictly read-only**. It must never perform operational actions.

| | |
|---|---|
| ✓ | Display system health |
| ✓ | Display deployment status |
| ✓ | Display version information |
| ✓ | Display publishing summary |
| ✓ | Display monitoring status |
| ✓ | Display backup status |
| ✗ | Publish |
| ✗ | Delete |
| ✗ | Edit |
| ✗ | Restart services |
| ✗ | Trigger jobs |

Any operational action must navigate to the existing specialized module that already owns that responsibility — publishing happens on the Publishing page, role changes happen on the Users page, nowhere else. **The dashboard never replaces existing tools. It aggregates them.** This is not a limitation to work around later; it is the dashboard's defining constraint, and it is what keeps it from slowly regrowing into a second, competing admin surface next to the modules Studio already has.

---

## Existing Functionality (do not rebuild)

The dashboard reuses existing Studio modules rather than duplicating them. It must **not** re-implement Publishing, Activity Log, Platform Statistics, or User Management — each already exists, already works, and already owns its domain. The dashboard's only relationship to them is to summarize and link, never to reproduce their functionality inline (see **Navigation**, below).

Confirmed by direct code read, not doc claims:

| Capability | Where it already lives | Status |
|---|---|---|
| **Platform content stats** (venue/destination completeness, status breakdowns) | `features/stats/` (`StatTile.tsx`, `StatusBreakdownStrip.tsx`, `MissingDataStrip.tsx`, `DestinationProgressGrid.tsx`), backed by `GET /editor/stats`, rendered on the existing Dashboard (`pages/Dashboard.tsx`) and Quality Center pages | ✓ Fully built |
| **Activity log** | `pages/Activity.tsx` → `features/activity/{ActivityPanel,ActivityTable}.tsx` + `useActivity.ts`, backed by `GET /editor/activity`, routed at `/activity`, in the sidebar nav | ✓ Fully built |
| **Publishing status** | `pages/Publishing.tsx` → `features/publishing/` (`PublishButton`, `RevisionList(Panel)`, `RevisionDetail`), backed by `POST /editor/publish` + `GET /editor/publish/revisions[/{id}]` + republish, routed at `/publishing` | ✓ Fully built |
| **User/role management** | `pages/Users.tsx` → `features/users/{UsersPanel,UsersTable}.tsx` + `useUsers.ts`/`useUpdateUserRole.ts`, backed by `GET/PATCH /editor/users`, routed at `/users` | ✓ Fully built |
| **Current-user identity** | `AuthContext.tsx` populates `role` from `GET /editor/me` on every session; email shown in `Header.tsx` | ✓ Fully built (session bootstrap, not a dedicated page) |
| **An available, unused "Settings" slot** | `pages/Settings.tsx`, routed at `/settings`, in the sidebar nav — currently a bare `PagePlaceholder` stub ("Workspace settings will be built here in a future sprint") | ✓ Route/nav exists, content does not |
| **Reusable stat-card primitive** | `StatTile.tsx` (icon + label + value) | ✓ Directly reusable for new health tiles |
| **Established feature convention** | `features/<name>/{api.ts, types.ts, use<Thing>.ts, <Name>Panel.tsx}` + `pages/<Name>.tsx` + route in `App.tsx` + nav entry in `config/navigation.ts` + permission gate via `features/auth/permissions.ts` | ✓ Consistent across all 4 existing features above — the new dashboard should follow this exactly |

**This means Publishing Status is already fully solved** — the "Publishing Status" item on your requested list is not new work, it's a pointer to `/publishing`, possibly surfaced as a summary tile linking there rather than rebuilt.

---

## Missing Functionality (genuinely new)

None of the following exist anywhere in Studio or its backend calls today — confirmed by grep, not inferred:

| Item | Gap | What it needs |
|---|---|---|
| **System Health** | No frontend surface exists for "is everything up" as a single view | A new dashboard page aggregating the items below |
| **API Health** | `GET /health` exists and is real (checks DB connectivity) — but **nothing in Studio calls it** | A new `features/ops/api.ts` function + hook |
| **Database Health** | Same endpoint as API Health (`/health`'s DB check *is* the database health signal — no separate endpoint exists or is needed) | Surfaced as part of the same call, not a second endpoint |
| **Storage Health** | No endpoint exists to check Supabase Storage reachability/bucket status | **New backend work required** — see Backend Gaps below |
| **Publishing Status** | Fully built already (see above) | Just link/summarize, don't rebuild |
| **Version Information** | `GET /` returns `{name, version}` — real, but **nothing in Studio calls it** | A new API call, trivial to add |
| **Environment** | `Settings.environment` exists server-side (`api/app/core/config.py`) but is **not exposed via any endpoint** — `GET /` only returns name+version today | **New backend work required** — add `environment` to the existing `GET /` response, or a new field on `/health` |
| **Background Jobs** | **None exist in this system today.** No task queue, no scheduler, no Celery/RQ/APScheduler anywhere in `api/` (consistent with the Backend Integration Audit's earlier finding that all work — publishing, media upload — is synchronous, request-response). This section should be scoped as "N/A — no background job system exists," not built speculatively. |
| **Backup Status** | `api/scripts/backup_db.sh` exists as a manual script; nothing records *when it last ran* or *whether it succeeded* anywhere queryable | Requires the backup script itself to write a record somewhere (a timestamped marker file, or a DB row) before Studio can display "last backup: X ago" — this is a real dependency, not just a frontend gap |
| **Monitoring Integration** | Nothing exists (per the Backend Integration Audit and Sprint 1 findings — zero Sentry/Better Stack/UptimeRobot anywhere) | This dashboard becomes the *display* surface once Sprint 1/2's external tools are chosen — likely a simple "last known status" pulled from whichever tool is picked, or just the dashboard's own live health checks standing in for it |
| **Analytics Integration (future)** | Nothing exists yet (Sprint 5 is still planning-only) | Explicitly marked future — a placeholder card at most, no real integration until Sprint 5 concludes |

### Backend gaps this surfaces (not frontend-only)

Two items above need small, real backend additions before Studio can display them at all:
1. **`environment` field on a system endpoint** — trivial, `Settings.environment` already exists, just isn't returned anywhere.
2. **A Storage-health check** — Supabase Storage reachability isn't checked by anything today; would need a small addition to `api/app/media/service.py` or a new lightweight check (e.g., a `HEAD` request to the configured bucket) exposed via `/health` or a new `/health/storage` path.

Both are small, additive, and match the existing `/health` pattern — not architecture changes. Flagging them explicitly rather than silently scoping them as "just frontend work."

---

## Design: Production Operations Dashboard

Following the existing `features/<name>/` convention exactly (per the audit — this is the established pattern, not a new one):

### Location
New nav entry, **not** a repurposing of the empty Settings stub — Settings' own placeholder text ("Workspace settings will be built here") describes a different, future concern (workspace preferences) from operational health, and conflating them would make Settings do two unrelated jobs. Recommend a new sidebar item, e.g. "Operations" or "System," routed at `/operations`.

### Permission gating
Per the audit: no existing permission fits "who can see ops/system info" — `USER_MANAGE_ROLES` is semantically about role management, not observability, and `CONTENT_VIEW` is too broad (every role including `viewer` has it). Recommend a new `Permission.SYSTEM_VIEW` value (backend `api/app/auth/permissions.py` + frontend mirror `features/auth/permissions.ts`), granted to `admin` only initially — publishers/editors don't need infrastructure visibility, and this matches the doc comment in `permissions.py` that says the map is meant to be extended exactly when a real need like this arises, not spun up speculatively ahead of one.

### Content, mapped to your 11 requested sections

| Section | Source | New backend work? |
|---|---|---|
| System Health | Aggregated view: API reachable? DB connected? (both from `/health`) | No |
| API Health | `GET /health` | No |
| Database Health | Same `/health` call's DB check | No |
| Storage Health | New lightweight Storage reachability check | **Yes, small** |
| Publishing Status | Summary card → existing `/publishing` page + latest `PublishRevision` timestamp (already fetchable via existing `GET /editor/publish/revisions`) | No |
| Version Information | See **System Information Card**, below | No |
| Environment | See **System Information Card**, below | **Yes, small** |
| Background Jobs | Static "No background job system in this architecture" notice | No (explicitly not built) |
| Backup Status | "Last backup" display — **blocked** until `backup_db.sh` records a queryable timestamp somewhere | **Yes** (backend/ops script change, separate from the dashboard itself) |
| Monitoring Integration | Placeholder linking out to whichever external tool Sprint 1 approves (UptimeRobot/Better Stack), or the dashboard's own checks standing in until then | Depends on Sprint 1 outcome |
| Analytics Integration (future) | See **Feature Flags** card's sibling — an explicit "Future — pending Sprint 5" placeholder, no real data | No (intentionally deferred) |

### System Information Card

**Status: Approved, required.**

A single required card, titled **System Information**, holding:

- Consumer Version
- Studio Version
- Backend Version
- Environment
- Current Git Commit
- Last Deployment

This card exists purely for **operational awareness and production support** — the fast "what exactly is running right now, and where" check someone reaches for while diagnosing an incident or confirming a deploy went out. It carries **no editing capability of any kind**: every field on it is a display value, sourced from build-time/deploy-time metadata and the existing `GET /` version endpoint (plus the new `environment` field noted in Missing Functionality, above) — never a form, never a control.

### Feature Flags Card (Placeholder)

**Status: Approved, placeholder only — no implementation.**

A second card, titled **Feature Flags**, exists purely to reserve dashboard space. Example entries it might eventually show:

- Beach Weather
- AI Recommendations
- Booking

None of these are real toggles today — there is no feature-flag system anywhere in this codebase, and none is being built as part of this plan. The card's only purpose right now is architectural: it reserves a slot in the dashboard's layout so that **when** a future runtime feature-flag system is introduced, it has an obvious, already-designed-for home, and the dashboard doesn't need a redesign to accommodate it. Building the placeholder now, even empty, is cheaper than retrofitting the layout later.

---

## Navigation

Every summary card that corresponds to an existing module is a link, not an inline management surface. Clicking it navigates to the module that already owns that responsibility:

```
Publishing Summary  →  Publishing module   (/publishing)
Activity Summary    →  Activity Log        (/activity)
User Summary         →  Users               (/users)
```

**The dashboard never contains full management interfaces.** A summary card shows just enough to answer "is this fine?" at a glance — a status, a count, a timestamp — and the moment more detail or any action is needed, navigation hands off to the specialized page that was built for exactly that job. This is the same rule as the Read-Only constraint above, expressed as a navigation pattern rather than a permissions one.

---

## Scope

This dashboard is an **operational entry point**. It is **not another admin application**.

It centralizes **visibility**. It does not centralize **responsibility**.

Every existing module (Publishing, Activity, Stats, Users) keeps full ownership of its own domain, including every action within it. The dashboard's entire contribution is a single screen that answers "what's the state of everything" faster than checking each module individually — nothing more, and deliberately nothing more.

---

## Recommended Priorities

1. **Version Information + API/DB Health** — zero backend work, `GET /` and `GET /health` already exist and are correct; this is pure frontend wiring following the exact established convention. Highest value-to-effort ratio, ship first.
2. **Publishing Status summary card** — also zero new backend work, just surfaces data the `publishing` feature already fetches. Natural second step alongside #1.
3. **New `Permission.SYSTEM_VIEW` + nav entry + route scaffold** — small, mechanical, needed before anything above can be gated correctly. Should land alongside #1, not after.
4. **Environment field** — small backend addition, low risk, unblocks a real requested section.
5. **Storage Health** — small backend addition, slightly more involved (an actual reachability check, not just returning existing config), but still additive and low-risk.
6. **Monitoring Integration placeholder** — sequenced after Sprint 1 concludes and a tool is actually chosen; building this before that decision would mean guessing at an integration shape.
7. **Backup Status** — the one item with a real cross-cutting dependency (the backup script itself must change first) — correctly sequenced after Sprint 4 (Backups & Recovery), not before.
8. **Background Jobs section** — lowest priority since it's a static "not applicable" notice, not a real integration; can ship whenever, or even be omitted until a real job system exists.
9. **Analytics Integration placeholder** — explicitly last, gated on Sprint 5 approval, placeholder-only even then.
10. **System Information Card** — sequenced alongside #1 and #4 once Version/Environment data is available; a required card, not optional, but has no earlier dependency than the data it displays.
11. **Feature Flags placeholder card** — lowest priority of all, since it displays nothing real by design; ship whenever convenient, including last.

---

## Revised Phase 3 Roadmap Note

This changes the shape of **Sprint 1 (Operational Monitoring)** from the previous plan: the Consumer-side items proposed there (a Consumer health route, in particular) are **withdrawn** per this scope change. Sprint 1's remaining scope — choosing an external uptime/log tool (UptimeRobot, Better Stack) and structuring API logging — is unaffected, since that work was always API-side. What changes is *where results are displayed*: this new Studio dashboard, not a Consumer-side surface.

`docs/PRODUCTION_READINESS.md` §3 (Monitoring) and its Consumer-related checklist items have been revised accordingly — see that document's changelog note.

---

**No code was written or modified to produce this plan.** Waiting for approval before implementing any part of it.
