# Studio v1.2 Product Gap Analysis — Legacy DataLab vs. Current Studio

**Type:** Product audit only. No code was written or modified.
**Legacy source:** `datalab-v1.7.8.3-boundary-control.html` (single-file app, 555 KB, ~10,270 lines, 419 functions) — inspected directly, not from memory or documentation.
**Studio source:** `datalab-next/` (current production frontend) + `api/` (current production backend), inspected directly.
**Method:** Every claim below traces to a specific function, screen, or file — legacy citations are `functionName()` / line ranges in the HTML file; Studio citations are file paths in this repo. Nothing here is speculative.

---

## Executive summary

The legacy DataLab is not a rough predecessor Studio quietly improved on — it is a mature, five-version-deep (`v1.7.8.3`), offline-first curation tool with real editor-productivity engineering behind it: autosave, full undo/redo, a global command-palette search, keyboard-driven review queues, per-field one-click actions on every social/contact channel, inline data-quality indicators in every list view, fuzzy duplicate detection, and an entire secondary workflow for outsourcing Instagram-handle research via Excel round-trips. Studio's architecture (server-backed, real auth/RBAC, immutable publish revisions, optimistic concurrency) is a genuine, defensible improvement over the legacy tool's single-user, browser-localStorage model — but the *editorial experience* built on top of that architecture is currently much thinner than what the legacy tool's daily users had. This is the same finding `docs/SCHEMA_GAP_AUDIT.md` already reached at the schema level in July; this report is the same finding at the *product* level, now that the schema/API blockers that audit found are resolved and 426 real venues are live in Studio.

The single largest, most concrete piece of evidence for this: **the legacy venue list table renders completion%, production-readiness, QA-flag count, Instagram presence, and cover presence as columns, at a glance, for every row** (`renderVenues()`, line 2375). Studio's venue list renders name, category, destination, and a status badge — nothing else (`datalab-next/src/features/venues/VenueList.tsx`). An editor working through 426 imported venues today has no way to see which ones need attention without opening each one individually.

---

# SECTION 1 — Studio strengths

What Studio already does better than the legacy tool — real, not consolation-prize, improvements.

1. **Real authentication and permissions.** Legacy DataLab has none — it's a single-user local tool with no login at all. Studio has Supabase Auth, 4 roles, and `require_permission()` enforced on every route (`api/app/auth/`). **KEEP.**
2. **Server-backed data with real concurrency control.** Legacy DataLab's "workspace" is a single JSON blob in `localStorage` — two people editing "at once" simply overwrite each other silently on next save (there is no server, no lock, no version field). Studio has `version`/`If-Match`/`ETag` optimistic concurrency (`api/app/api/concurrency.py`) with a real conflict UI (`datalab-next/src/components/RejectDialog.tsx`'s sibling conflict banner in `VenueWorkspace.tsx`). **KEEP.**
3. **Immutable publish history as a first-class concept.** Legacy DataLab's "Production Build History" (`renderProductionBuildHistory()`, line ~1455) is real and good, but publishing is a single global JSON overwrite with a "trust gate" checkpoint (`runTrustGate()`) at the moment of publish. Studio's `publish_revisions` table + partial unique index (`uq_publish_revisions_is_current`) makes "exactly one current revision, every past one preserved and re-activatable" a database-enforced invariant, not an application convention. **KEEP.**
4. **Referential-closure enforcement.** Legacy DataLab has no equivalent check at all — a venue can point at a destination that isn't itself published-ready, and nothing stops it. Studio's approve-time gate + publish-time join filter (`api/app/publishing/engine.py`) is a real, new-to-Studio correctness guarantee. **KEEP.**
5. **A real editorial workflow state machine.** Legacy DataLab's "verification" status is a flat 3-value field (`Unreviewed`/`Verified`/`Needs Review`) with no transition rules. Studio's `draft → review → approved` with `CHECK`-constrained status and dedicated submit/approve/reject endpoints is more rigorous. **KEEP.**
6. **File-upload hardening.** Legacy DataLab trusts whatever the browser gives it for a dropped file (`handleCoverDrop`); Studio sniffs magic bytes, caps size both early and post-read, and sanitizes filenames (`api/app/media/service.py`). **KEEP.**
7. **A real API other tools can eventually consume.** Legacy DataLab's "production dataset" is a hand-assembled JSON blob (`buildProductionDataset()`) with no query surface. Studio has a real REST API with pagination, filtering, and a documented contract. **KEEP.**

---

# SECTION 2 — Critical functionality lost from the old DataLab

These should return before the next production release. Each entry names the exact legacy mechanism and the exact gap in Studio today.

### 2.1 List-view data-quality indicators (the single biggest gap)
**Legacy:** `renderVenues()` (line 2375) renders Completion%, Production-readiness badge, QA-flag count, Instagram present/missing, and Cover present/missing as columns on every row, for the whole filtered list at once.
**Studio:** `VenueList.tsx` renders name, category, destination, and status only.
**Why critical now:** 426 real venues just landed via the legacy import, all in `draft`. Nobody can currently see which ones are missing Instagram/cover/coordinates without opening each one. This isn't a nice-to-have — it's the exact next task (getting the imported data production-ready) that the tool can't currently support.

### 2.2 One-click open/copy for every contact channel
**Legacy:** every social/contact field in the editor (`_socFieldRow()`, line 3440) has a dedicated "open" button (☎ for phone → `tel:`, 💬 for WhatsApp → `wa.me/…`, ↗ for everything else) plus a Clear button, with the destination URL computed correctly per channel (`socialFieldHref()`, line 3407 — e.g. it builds `https://instagram.com/{handle}` from a bare handle, `https://wa.me/{digits}` from a phone number). The Google Maps field additionally has a dedicated Copy button (line 2643).
**Studio:** none of these exist anywhere in `VenueWorkspace.tsx` or its sections (`ContactSection.tsx`, `LocationSection.tsx`) — every phone/WhatsApp/Instagram/Facebook/TikTok/Maps value is a plain text field or plain link, no click-to-open, no click-to-copy.
**Why critical:** this is explicitly one of the user-requested productivity checks (Section 8), and it's a small, mechanical gap against a proven-good pattern already fully specified in the legacy code.

### 2.3 Inline field validation with per-field error messages
**Legacy:** `validateSocialField()` + the `-err` div under every social field (line 3453) shows a specific message ("⚠ Invalid handle format") the instant a field goes bad, before Save is even clicked.
**Studio:** validation only happens on Save (`useUpdateVenue`) or via the separate explicit Validate action; there's no live per-field feedback while typing.

### 2.4 Missing-data indicator chips on the editor itself
**Legacy:** `openVenueEditor()` (line 2526) computes and displays a chip row — "⚠ Cover missing", "⚠ Instagram missing", "⚠ Coordinates missing", "⚠ Description missing" — right at the top of the editor, or a green "✓ No missing data" chip if clean.
**Studio:** no equivalent anywhere in `VenueWorkspace.tsx`.

### 2.5 Quality warnings on cover images specifically
**Legacy:** `checkCoverQuality()` (line 4210) flags non-HTTPS URLs, wrong file extensions, oversized files (>3MB), and AI-placeholder images, shown inline in `renderQualityWarnings()`.
**Studio:** `ImagesSection.tsx` has client-side type/size checks before upload, but nothing that evaluates an *already-set* cover image's quality.

### 2.6 Duplicate detection
**Legacy:** `_findDups()` (line 9905) runs a name-similarity + destination-match score against every venue and surfaces the top 3 candidates whenever a new venue is being reviewed for import — genuine fuzzy matching, not exact-string.
**Studio:** no duplicate detection anywhere. (Note: the legacy *import* script this project just ran, `api/scripts/import_legacy_dataset.py`, does have its own 4-tier matching for the one-time migration — but that's a migration tool, not an ongoing editorial feature an editor can invoke on demand.)

### 2.7 A real Data Quality Center
**Legacy:** `renderQA()` (line ~6873) — filterable by severity/type/status, a dedicated "Adjacent Bleed Risk" table (venues plausibly misassigned to a neighboring destination), an "Unknown District" table, a one-click "🔧 Repair Workspace" that dry-runs then applies structural fixes (destSlug mismatches, invalid destination refs), and per-flag close/reopen toggles with an activity trail.
**Studio:** nothing — no QA-flag concept exists in the schema or UI at all.

### 2.8 Global cross-entity search
**Legacy:** `openSearchOverlay()` (line 1614, invoked by pressing `/` from anywhere) searches venues, beaches, destinations, social records, registry, and QA flags simultaneously and jumps straight to the matching section.
**Studio:** `VenueFilters`/`DestinationFilters` only filter within their own already-open page; there's no cross-entity search and no keyboard shortcut to invoke anything.

### 2.9 Undo/redo and autosave
**Legacy:** a real undo/redo stack (`pushUndo()`, `undo()`, `redo()`) bound to `Cmd/Ctrl+Z`/`Cmd/Ctrl+Shift+Z`, plus autosave to `localStorage` every 30s while dirty (`startAutosave()`, line 869) and a save-on-close hook.
**Studio:** none. `hooks/useDraft.ts`'s own comment says autosave is intended for later and isn't built. The only safety net today is a browser `confirm()` dialog before navigating away from unsaved changes.

---

# SECTION 3 — Important improvements (useful, not blocking)

1. **Keyboard-driven review queue.** Legacy's "New Venues" review drawer (`openReviewDrawer`, line 9915) supports `j`/`k` (or arrow keys) to move between pending records and `a`/`r`/`l` to accept/reject/defer without touching the mouse (line 10149). Studio's bulk-approve flow requires checkbox-selecting and clicking a button per batch — workable, but much slower for reviewing one-at-a-time.
2. **Generic bulk field editing.** Legacy's `bulkApply()` (line 2066) can set *any* field across a selection, with a safe dedicated path for destination moves and full undo support. Studio's bulk update is narrower (category and/or destination only, via the unified `PATCH /editor/venues/bulk` — itself a real Phase 2 improvement over the two endpoints it replaced, but still narrower in *field* coverage than legacy).
3. **Excel-based Instagram research workflow.** Legacy has a complete round-trip: export a review template (`igDownloadTemplate()`), have someone research handles offline, re-import with a diff preview (`_analyzeIGImport()`/`igShowPreview()`), apply, and roll back if needed (`igRollback()`). Given the imported dataset has Instagram handles for only 117/428 venues today, this specific workflow directly addresses the platform's current biggest completeness gap. Studio has nothing like it.
4. **Per-destination progress view on the dashboard.** Legacy's `destinationProgress()` + the dashboard's "Destination Progress" grid (line 2254) shows a completion bar per destination, click-through to that destination's venues. Studio's dashboard has no per-destination breakdown at all.
5. **Hover preview thumbnails.** Legacy's `showHoverPreview()` (line 4179) shows a floating image preview on mouse-hover over any cover thumbnail in list/grid views — no click required. Studio requires opening the workspace to see an image.
6. **CSV/JSON per-section export beyond what exists today.** Studio's export (`GET /editor/venues/export`) covers venues and destinations. Legacy exports six distinct sections independently (venues, beaches, access, social, covers, qa_flags) plus a full-workspace JSON dump — not urgent given Studio's narrower current data model, but the *pattern* (per-concern export, not just per-entity) is worth keeping in mind as Studio's schema grows.
7. **Backup history with one-click restore.** Legacy's `listBackups()`/`restoreBackup()` (surfaced in the Import/Export screen) keeps a rolling local backup history an editor can restore from without touching a terminal. Studio's backup/restore is currently an operator-only `pg_dump`/`psql` shell script (`api/scripts/backup_db.sh`) — appropriate for infrastructure, but there's no editor-facing equivalent for "I made a mistake an hour ago, get me back to before."

---

# SECTION 4 — Nice-to-have improvements

1. **Aliases/registry management UI.** Legacy's Registry screen (`renderRegistry()`, line ~3274) manages destination aliases and explicit "non-alias" pairs (things that look similar but must never be merged). Studio's `destinations.aliases` column exists but has no UI (already flagged in `docs/SCHEMA_GAP_AUDIT.md` §4 item 7).
2. **Column-sortable tables.** Neither tool actually supports click-to-sort-by-column today (verified: legacy's `.sort()` calls are all internal fixed orderings, not a user-facing sort control) — this is a genuine gap in *both* tools, not a regression, but worth adding to Studio given how standard it is for admin tables.
3. **Right-click / context menus.** Legacy has none either (no `contextmenu` handler anywhere in the file) — not a regression, no action needed.
4. **Saved filter presets.** Neither tool has this. Worth considering for Studio given how much richer its filter set could become (see Section 8), but it's genuinely new territory, not a returning feature.
5. **Mobile drawer/responsive nav polish.** Legacy has real mobile handling (`isMobile()`, `openDrawer`/`closeDrawer`, a focus-trap for the sidebar). Studio's responsiveness wasn't part of this audit's scope to verify in depth, but worth a follow-up check.

---

# SECTION 5 — Features that should never return

1. **Interactive polygon boundary drawing/editing** (`startManualBoundaryEdit`, `saveManualBoundary`, the entire Geo Command Center's freehand drawing tools). **Why not:** Studio's `docs/DATABASE.md` already made this call deliberately and correctly — a destination's `boundary` is a GeoJSON value the platform stores and validates the *shape* of (`_validate_boundary_shape` in `api/app/api/routes/destinations.py`), not a feature the editorial tool needs to let anyone hand-draw. It was legacy-tool-specific curation tooling for building the original dataset, not an ongoing product need.
2. **Automatic boundary generation from convex hulls** (`generateAutoBoundary`, `convexHull`, `repairOldBoundaries`). **Why not:** a one-time data-generation technique used to bootstrap boundaries that didn't exist yet. The boundaries now exist (10 of 25, imported verbatim into `legacy_geo`-adjacent `boundary` column) — there's nothing left to auto-generate.
3. **The Geo Review Queue and its `1`/`2`/`3`/space hotkeys** (`geoReviewAction`, `buildGeoReviewQueue`) for classifying whether a venue's coordinates fall inside/outside/excluded relative to a boundary. **Why not:** this whole workflow's *output* (the `geo.status`/`reviewed`/`history` object) is exactly what's now preserved verbatim in `venues.legacy_geo` per `PLATFORM_SPEC_v1.0_FROZEN.md` §7.13 — a deliberate, already-made decision to keep the *history* as an opaque archival record without rebuilding the *workflow* that produced it. Re-adding this review queue would mean re-building a geometry-review feature the platform explicitly decided was tooling, not product.
4. **Boundary overlap conflict detection** (`checkBoundaryOverlaps`, `activateConflictFocus`, the entire Conflict Focus mode). **Why not:** same reasoning as #1-3 — a one-time data-integrity pass for building the original 25 boundaries, not a recurring editorial need.
5. **Field Locks** (`lockVenueFields`/`unlockVenueFields`) — a mechanism to prevent a specific field from being overwritten by a future data merge. **Why not:** this exists because legacy DataLab's primary ingestion path was repeatedly re-merging bulk exports over the live workspace, and locks were the guard against that clobbering manual edits. Studio has no recurring bulk-merge-from-external-source workflow (the legacy import was explicitly one-time) — there's nothing for a lock to protect against in Studio's actual architecture.
6. **Merge Mode / Merge Profile / Scope / Dry-Run diff engine** (the entire `renderMerge`/`_analyzeMerge`/`_applyMerge` system, ~800 lines). **Why not:** this whole subsystem exists to repeatedly reconcile two independently-evolving datasets (the legacy tool's workspace vs. re-exports from an even older system). Studio has one authoritative database — there is no second dataset to merge against on an ongoing basis. (The one-time legacy import already borrowed this system's *reasoning*, not its code — `api/scripts/import_legacy_dataset.py`'s 4-tier matching is a deliberately much smaller, purpose-built version of exactly this idea, scoped to the one migration it needed to do.)
7. **NAS connection monitor** (`startNASMonitor`, `checkNAS`) — pings a local network-attached-storage health endpoint every 30s. **Why not:** legacy-infrastructure-specific (the tool assumed a local NAS backing store); irrelevant to Studio's Supabase-backed architecture.
8. **PWA install prompts** (`pwaInstall`, `pwaDismiss`, `offerUpdate`). **Why not:** legacy DataLab was designed to be installed as an offline-capable local app. Studio is a normal web app behind auth; there's no product reason to make it installable, and no evidence this was ever a workflow editors relied on versus just opening a browser tab.
9. **Theme/language toggles** (`setTheme`/`toggleTheme`, `setLang`/`toggleLang`). **Why not:** no evidence either was ever meaningfully used (the exported dataset has zero populated `translations`, per `docs/LEGACY_IMPORT_AUDIT_v19.md`), and Studio's own `translations` JSONB column (added Phase 1, minimal editing added Phase 3 EP23) is a cleaner, schema-backed starting point if bilingual editing becomes a real need later — not a reason to resurrect the legacy tool's UI-chrome-only language toggle.

---

# SECTION 6 — Dashboard redesign recommendations

**Does Studio's current dashboard answer the questions this audit was asked to check?** No — checked one by one against the actual `Dashboard.tsx`/`stats.py`:

| Question | Studio today | Verdict |
|---|---|---|
| How healthy is the database overall? | 7 flat numbers, no health signal | ❌ No |
| What needs work? | Nothing surfaced | ❌ No |
| What destination is incomplete? | Not shown | ❌ No |
| How complete is each destination? | Not shown | ❌ No |
| How many venues are published? | Not shown (only total venue count) | ❌ No |
| How many drafts? | Not shown | ❌ No |
| How many images missing? | `with_cover` exists, but as a raw count, not "missing" framed, and not clickable | ⚠️ Partial |
| How many Instagram links missing? | Same — `with_instagram` exists, inverted framing, not clickable | ⚠️ Partial |
| How many websites missing? | Same — `with_website` exists, no percentage even shown | ⚠️ Partial |
| How many Google Maps links missing? | Not tracked at all | ❌ No |
| How many duplicate records? | Not tracked at all | ❌ No |
| How many venues need review? | Not shown (no status breakdown) | ❌ No |

**Recommended dashboard, directly modeled on the legacy tool's proven layout (`renderDash()`, line 2209) — every element below has an exact legacy precedent cited:**

1. **A single top-line completion score** (legacy: the gradient banner at the top, `proj.pct`) — e.g. "68% Production Ready" — computed from the same completion criteria already used per-venue.
2. **A status breakdown strip, each tile clickable through to a pre-filtered venue list** (legacy: `stat-item` tiles with `onclick="navigate('venues');UI.flt={...}"`) — Draft / Review / Approved / Total, each one click away from the exact filtered list.
3. **Per-destination completion bars** (legacy: `destinationProgress()` → the "Destination Progress" card grid) — one row per destination, a progress bar, `X ready / Y total`, click-through to that destination's venues.
4. **A missing-data strip with real counts, framed as gaps, each clickable** (legacy: the second `stat-strip`) — Missing Cover / Missing Instagram / Missing Website / **Missing Maps URL** (new — Studio doesn't track this today) / Missing Coordinates / Missing Description, each colored red/yellow by severity and clickable straight into the matching filtered list.
5. **Coverage percentage bars per field** (legacy: the `cov-grid` of Instagram/Website/Cover/Coordinates/Verified percentages) — the same 5-7 fields, as horizontal progress bars, not just raw counts.
6. **A duplicate-count tile** (net-new relative to what Studio's schema currently supports — see Section 7 for the detection mechanism this would surface).
7. **Recent activity feed** (legacy: `WS.activity_log.slice(0,8)` rendered as a timestamped list) — Studio already has a full `activity_log` table and an Activity page; surfacing the last 5-8 entries directly on the dashboard (not just on its own page) closes this gap cheaply.

---

# SECTION 7 — Data Quality Center recommendations

A professional data-quality dashboard for Studio, modeled on the legacy `renderQA()` screen but adapted to what Studio's schema can actually support today:

1. **A dedicated `qa` navigation entry**, separate from the main Dashboard — the legacy tool treats "here's the summary" (Dashboard) and "here's the actionable worklist" (QA Center) as two different jobs, and that split is worth preserving.
2. **Filterable by issue type and severity** (legacy: severity `high`/`medium`/`low`, type dropdown) — issue types Studio's current data can already support without any schema change: `missing_cover`, `missing_instagram`, `missing_website`, `missing_maps_url`, `missing_coordinates`, `missing_description`, `missing_category`-equivalent (not applicable post-import, all 428 have one), `likely_duplicate` (see #4 below).
3. **A dedicated duplicate-venue detector**, direct port of the legacy approach: name-similarity scoring plus a same-destination bonus (`_findDups()`, `_nameSim()`), surfaced as pairs/groups an editor can review and either merge, rename, or dismiss as "not a duplicate." Given the legacy import's own audit found near-identical name+destination pairs *within the imported data itself* (`docs/LEGACY_IMPORT_AUDIT_v19.md`'s duplicate-coordinate findings — 44 pairs, 95 venues), this isn't hypothetical: there is very likely real duplicate content sitting in production right now that nothing currently surfaces.
4. **Broken/invalid URL detection** — a lightweight format check (not a live fetch) across `website`, `maps_url`, `instagram_handle`-derived URL, `facebook_handle`, `tiktok_handle` — flagging anything that isn't a well-formed URL/handle, mirroring `checkCoverQuality()`'s non-fetch, format-only approach for images.
5. **Per-issue action, not just a list** — legacy's QA cards show `→ {action}` (a specific next step) alongside each flag, and a one-click close/reopen toggle with an audit trail (`toggleQA()`, logged via `activity_log`). Studio already has `activity_log` — logging QA-flag state changes there costs nothing new architecturally.
6. **Export the flag list to CSV** (legacy: `exportCSV('qa_flags')`) — Studio's existing export infrastructure (`GET /editor/venues/export`) already proves the pattern; a `qa`-scoped export is a small extension, not new machinery.

---

# SECTION 8 — Editor Productivity recommendations

Concrete, evidence-based click reductions — every item below cites the exact legacy pattern to copy and the exact Studio location it applies to.

| Action today in Studio | Clicks/steps | Legacy pattern to copy | Where in Studio |
|---|---|---|---|
| Open a venue's Google Maps link | Click the plain link (1 click, but no dedicated affordance, easy to miss among other text) | Dedicated 🌍 Open + 📋 Copy buttons next to the field (line 2642-2643) | `LocationSection.tsx` |
| Call a venue's phone number | Not possible — phone is a plain text field, not even a link | `tel:` link via ☎ button (`socialFieldHref('phone', …)`) | `ContactSection.tsx` |
| Message a venue on WhatsApp | Not possible — same, plain text | `https://wa.me/{digits}` via 💬 button | `ContactSection.tsx` |
| Open a venue's Instagram profile | Not possible from the editor — must construct the URL manually or leave Studio | 📸 button → `https://instagram.com/{handle}` | `ContactSection.tsx` / `BasicInfoSection.tsx` |
| Same for Facebook/TikTok/Website | Not possible from the editor | ↗ button via `socialFieldHref()` | `ContactSection.tsx` |
| See which venues in a list are missing key data | Open each venue individually | Inline table columns (Completion%, IG ✓/—, Cover ✓/—) | `VenueList.tsx` |
| Find a venue by name from anywhere in the app | Navigate to Venues page, then use its filter | Global `/`-triggered search overlay across all entities | New: app-level, not page-level |
| Review a batch of new/pending venues one at a time | Checkbox each, click a bulk button | Keyboard-driven drawer: `j`/`k` to move, `a`/`r`/`l` to accept/reject/defer | N/A today — no review-drawer equivalent exists |
| Undo an accidental edit | Not possible — must manually re-enter the old value | `Cmd/Ctrl+Z` | App-wide |
| Preview a cover image without opening the venue | Not possible | Hover-preview thumbnail (`showHoverPreview`) | Wherever cover thumbnails render in list views |

**Ranked by time saved × frequency (severity):**

- **High severity** (done dozens of times per editing session, currently either impossible or multi-step): one-click open for phone/WhatsApp/Instagram/Facebook/TikTok/Maps; inline list-view quality indicators.
- **Medium severity** (done regularly, currently possible but slower than necessary): global search; keyboard-driven review triage; copy-to-clipboard for Maps URL.
- **Low severity** (nice quality-of-life, lower frequency): hover-preview thumbnails; undo/redo.

---

# SECTION 9 — Prioritized roadmap

### Phase 1 — Critical

| Item | Complexity | Why Phase 1 |
|---|---|---|
| Inline quality indicators in venue list (completion%, IG/cover/maps presence) | **Medium** | Directly blocks the immediate next task: making 428 imported venues production-ready. No visibility into what's missing today. |
| One-click open buttons for phone/WhatsApp/Instagram/Facebook/TikTok/Maps | **Small** | Legacy's `socialFieldHref()` logic is ~15 lines, fully specified, ready to port. High-frequency action currently missing entirely. |
| Missing-data indicator chips in the venue editor | **Small** | Same underlying computation as the list-view indicators above; cheap to add once that data is being computed. |
| Dashboard redesign — missing-data strip + per-destination completion (Section 6, items 1-2-4-5) | **Medium** | Same reasoning as the list-view indicators — the dashboard is currently the wrong shape for "426 venues just landed, what needs work." |

### Phase 2 — High Value

| Item | Complexity | Why Phase 2 |
|---|---|---|
| Data Quality Center (Section 7) with duplicate detection | **Large** | Real, standalone feature — new nav entry, new detection logic, new UI. High value given confirmed likely-duplicate content in the imported data, but not a blocker to basic editing. |
| Global cross-entity search (`/` shortcut) | **Medium** | Genuine productivity win, self-contained, doesn't depend on other Phase 1/2 work. |
| Instagram bulk-research Excel workflow (export template → offline research → reimport with diff preview) | **Large** | Directly addresses the platform's single biggest completeness gap (only 117/428 venues have Instagram), but it's a full round-trip feature (export, template, parse, diff, apply, rollback) — real scope. |
| Undo/redo for single-record edits | **Medium** | High editor trust/safety value; legacy's implementation is a straightforward operation-log pattern, but needs care to integrate with Studio's server-backed save (not local-only like legacy). |

### Phase 3 — Quality of Life

| Item | Complexity | Why Phase 3 |
|---|---|---|
| Autosave / unsaved-draft recovery | **Medium** | Real value, but Studio's dirty-check-before-navigate already prevents the worst-case (silent data loss on navigation); this closes a narrower gap (browser crash / accidental tab close). |
| Hover-preview thumbnails for cover images | **Small** | Pure convenience, no data-quality impact. |
| Keyboard-driven review-queue triage (`j`/`k`/`a`/`r`/`l`) | **Medium** | High value once volume justifies it, but Studio's current bulk-approve flow is a workable substitute for now. |
| Column-sortable tables | **Small** | Neither tool has this today (verified) — genuinely new capability, not a returning one; low urgency. |
| Backup history + one-click restore for editors | **Medium** | Operator-level backup/restore already exists and is solid (`api/scripts/backup_db.sh`, exercised successfully during the legacy import); this is about giving *editors* self-service recovery, lower urgency than the operator-level guarantee already in place. |
| Aliases/registry management UI | **Small** | Column already exists (`destinations.aliases`), just needs a form — low complexity, low urgency since nothing currently depends on it. |

---

## Appendix — audit coverage checklist

Every category the task asked to be audited, with where it's addressed above:

Navigation (§9 Phase 2), Dashboard (§6), Statistics/Analytics (§6), Venue management (§2.1-2.4), Destination management (§4.1), Beach management (§5.6 — correctly not returning), Gallery (out of scope per prior audit, unchanged), Cover management (§2.5, §3.5), Social links/Instagram/Facebook/TikTok/Website/Maps/Phone/WhatsApp workflows (§2.2, §8), Coordinates (§2.4, §6), Status/Draft/Publishing workflow (§1.3, §1.5), Search/Advanced search/Filtering (§2.8, §4.4), Sorting (§4.2 — gap in both tools), Pagination (already fixed this session, out of scope here), Bulk selection/actions (§3.2), Import/Export/CSV/JSON (§1.7, §3.6), Keyboard shortcuts (§2.9, §3.1, §8), Right-click menus (§4.3 — absent in both), Copy buttons (§2.2), Quick actions (§8), External links (§2.2, §8), Missing-data/quality/progress indicators (§2.1, §2.4, §2.5, §6), Validation/warnings/errors (§2.3, §2.5), Notifications (legacy's `toast()` ≈ Studio's existing error/success messaging, parity confirmed, no gap found), History (§3.7, legacy `activity_log` ≈ Studio `activity_log`, parity), Undo (§2.9), Autosave (§2.9), Review queues (§3.1), Duplicate detection (§2.6, §7), Category management (parity — Studio's CHECK-constrained taxonomy is the more rigorous of the two), Destination/Venue statistics (§6), Performance/Loading states (not evaluated — requires runtime profiling, out of scope for a static code audit), Developer tools (legacy has none beyond `console.error` logging; no gap), Power-user workflows (§2.9, §3.1, §8).
