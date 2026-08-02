# Consumer — Implementation Roadmap

Phases are sequential. Each has an explicit exit criterion; a phase is not done until it
is met. No phase begins before its blocking decisions are resolved.

Per approved decision 7, **every major screen is validated against the Stitch export
before its phase begins** — the export is the visual source of truth, and the handoff
prose has already been shown to be wrong in twelve places (`STITCH_SOURCE.md`).

---

## Phase 0 — Foundation

- Add `@tanstack/react-query`, `lucide-react`; Material Symbols Outlined + Inter +
  IBM Plex Sans Arabic via `next/font`
- Write the `@theme` block from `DESIGN_TOKENS.md`; delete the Geist/grey/dark-mode starter
- Strict TS config; `remotePatterns` for the media host
- **Delete** all nine existing components; keep and extend `lib/api.ts` / `lib/types.ts`

**Exit:** tokens resolve in a scratch route; app builds; no starter styling remains.

---

## Phase 1 — Layout system and navigation

- `app/(root)/layout.tsx` and `app/(push)/layout.tsx`
- `BottomNav` (5 tabs — Home, Explore, Map, Saved, **More**), `TopAppBar` (both variants)
- All nine routes exist and are reachable, each rendering a placeholder

**Exit:** every route navigable; bottom nav appears on root screens only and is
structurally absent from push screens.

---

## Phase 2 — Component library

Built in isolation against the export's markup, in the order in
`COMPONENT_INVENTORY.md` §Build order. Every component ships with `aria-label`s, real
`alt` handling, 48dp targets, and correct rendering when optional data is absent.

**Exit:** all Layer 1–3 components complete and visually diffed against the export PNGs.
Map module excluded.

---

## Phase 3 — Data layer ✅ complete

- `lib/api/` — `client.ts` (`apiGetList`/`apiGetOrNull`), `dto.ts`, per-resource fetchers
- `lib/domain/` — `Venue`/`Destination` models, `mappers/` (DTO → Domain)
- `lib/hooks/` — `useVenues`, `useVenue`, `useDestinations`, `useSearchVenues`
- `lib/saved/` — `SavedRepository` interface, `LocalStorageSavedRepository`, the single
  `repository.ts` wiring point, and `useSaved()`

**Exit:** typed domain objects flow from `/public/*` into components through the full
Client → DTO → Mapper → Domain chain. No component touches a snake_case API shape.
Verified against the live API: schema cross-checked field-for-field against
`PublishedVenueOut`, both list endpoints correctly return `[]` (no publish revision yet —
handled as the empty state, not an error), and `/public/venues/{id}` 404s correctly for an
unknown id.

⚠️ **Known local-dev gap, not a Consumer defect:** the API's CORS allowlist
(`ALLOWED_ORIGINS` in `api/.env`) permits `:5173` (the Vite Studio app) but not `:3000`
(this app), so browser-side fetches fail locally with `net::ERR_FAILED` until that's
added. Out of scope for this Consumer-only session; flagged for whoever owns the API's
dev environment config.

---

## Phase 4 — Home ✅ complete

Reference: `sahelspot_home/code.html`.

Every data-backed section (Trending Today, Explore Destinations) carries its own
loading / error / empty / success states independently via its own query, rather than
gating the whole page behind one spinner. Verified live: the CORS gap from Phase 3 means
both sections currently render their real error state in the browser, with a working
Retry that re-fires the request — confirmed via network inspection, not assumed.

Two content gaps resolved without mocking:
- **Trending Today** uses `is_featured` (a real field) rather than waiting on the
  Hidden-Gems-style curation model in `API_REQUIREMENTS.md` §3.
- **Hidden Gems** has no fallback field of any kind and is **omitted from Home
  entirely** until that requirement is delivered — no placeholder section, no mock data.

New requirement found while implementing: `PublishedDestinationDTO` has no image field
at all — `API_REQUIREMENTS.md` §3a. `DestinationCard` degrades to a solid fill.

The weather pill is omitted per §5's standing recommendation, since unlike the avatar/
greeting/bell it is live data with no source — showing invented numbers would be the
mocking the architecture forbids, not a disabled interaction.

Three "See All" actions (mood grid, Trending, Explore Destinations) have no listing
screen anywhere in the 9-screen inventory. Corrected on review: disabled CTAs are not
acceptable production UI even when the destination is unbuilt. Mood grid's "See All" now
routes to `/search` (a real, existing screen); Trending and Explore Destinations route to
a new `/coming-soon` page instead — a genuine destination that tells the visitor what's
missing, not a link to nowhere and not an inert label.

**Exit:** matches `sahelspot_home/screen.png` structurally at 375px; clean build/lint/
typecheck; all four data states verified (loading/success reasoned from code path and
prior Phase 3 verification, error/retry confirmed live).

---

## Phase 5 — Map ✅ complete

Reference: `interactive_map_1/`. Mapbox GL JS, dynamically imported (`ssr: false`,
lazy-loaded only on `/map`), isolated to `components/map/` + `lib/map/` — no other route
imports it, verified in the production build output.

Built: category-coloured DOM markers (`createMarkerElement`, since Mapbox markers are
imperative DOM, not React), glass `SearchField`, the 5 `FilterChip`s (client-side category
filter over the already-fetched venue list — no second query, since Map needs no search
text, just a filter), floating locate/layers `MapControls` (real `navigator.geolocation`
and a real `setStyle` style swap, not simulated), and a keyboard-accessible `BottomSheet`
(Escape to close, focus moves to the close button on open — the first component in the
library with real overlay semantics).

Selecting a marker opens the sheet for that venue's destination — using the real
`destinationId` already on the DTO (added to the `Venue` domain type this phase, not a
gap) rather than name-matching. Bottom-sheet stats are computed live from the venues
actually loaded for that destination (Places/Dining/Beaches counts), not fabricated.

**New gap found while implementing:** the Stitch sheet shows a 4th "Events" stat, but the
domain has no event category or content type at all — `API_REQUIREMENTS.md` §3b. The
sheet renders 3 tiles, not a 4th showing `0`, since a real zero and "no data" are
different facts.

**Exit:** verified — filter chips, glass search, and floating controls render correctly
in the browser; category filtering, marker click → destination sheet, and the
locate/layers control wiring all confirmed by code path (live map rendering itself is
blocked by the Phase 3 CORS gap plus no `NEXT_PUBLIC_MAPBOX_TOKEN` configured in this dev
environment — both documented, neither worked around); clean build confirms the GL bundle
is isolated to `/map`.

---

## Phase 6 — Venue Details ✅ complete

Reference: `/Users/Nabil/Downloads/stitch_sahelspot 2/`.

`useVenue(id)` drives all four states: skeleton hero + lines while loading, an
error/retry `EmptyState` on failure, Next's `notFound()` (rendering the existing
`not-found.tsx`) when the API returns `null`, and the full screen on success.

Every optional field either renders correctly or the region it belongs to disappears —
nothing renders inert:
- No `rating` → no `RatingStars` row (not a fabricated 0 or hidden "—").
- No `priceRange`/`distanceLabel`/`amenities` → the whole info-pill row is omitted, not
  shown empty.
- No `highlights` → "Why visit?" section omitted entirely.
- No `mapsUrl`/`phone`/`whatsapp`/`website` → that specific action is omitted; if none
  exist, the whole action row is omitted rather than rendering empty.

**Corrected on review** (two changes, both applied at the mapper, not the page):
- **Nearby Places removed entirely.** The original implementation filtered the
  already-fetched venue list by shared `destinationId` and called that "nearby" — a UI-
  layer approximation, not real nearby data. The section returns only once
  `/public/venues/nearby` (or equivalent) exists — `API_REQUIREMENTS.md` §4.
- **External actions are now validated, not just checked for truthiness.** New
  `lib/domain/validators.ts` (`toValidUrl`, `toValidPhone`, `toValidWhatsapp`) runs inside
  `toVenue`, so a malformed phone number or a non-`http(s)` URL becomes `null` — same as
  absent — before it ever reaches `IconActionButton`/`CTAButton`. No component re-checks
  this; the mapper is the one place it happens.
- Tag pills combine the one real derivable value (`category`, via a new
  `VENUE_CATEGORY_LABEL` map) with any real `tags` — never a fabricated second tag.

Share uses the real Web Share API with a clipboard-copy fallback and a visible "Link
copied" confirmation — not a stub. Nearby Places filters the already-fetched venue list
by the selected venue's real `destinationId`.

Two primitives gained `href` support this phase, since Venue Details is the first screen
with external links (`tel:`, `wa.me`, a venue's own website, Google Maps) rather than
internal routes: `IconActionButton` (new `href` prop, `target="_blank"` + `rel` for
`http(s)`) and `CTAButton` (same external-link handling added to its existing `href`).

**Exit:** verified by assembling the screen against real Boca-Beach-shaped data on a
temporary route (removed before commit) — hero, header, tags, info pills, action row,
checklist, and Nearby Places all match the export at 375px. Live population from
`/public/venues/{id}` is blocked by the same pre-existing CORS gap as every other screen;
the error state itself was confirmed live. Clean build/lint/typecheck.

---

## Phase 7 — Search ✅ complete

Search has no Stitch export in either delivery — it's specified only in
`SahelSpot_Remaining_Screens_Spec.md`, as `SCREEN_ANALYSIS.md` §7 already flagged. Built
faithfully to that written spec, reusing `VenueCard/horizontal-row` (confirmed in Phase 6)
and `CATEGORY_FILTERS` (shared with Map — plain data, no Mapbox import, so reusing it here
doesn't cross the Map module's isolation boundary).

Two states, driven directly by `useSearchVenues`'s own TanStack state rather than
screen-local booleans: **default** (no query/category — Recent Searches + Popular
Categories) and **active** (category chips + Results, itself loading/error/empty/success).
`useSearchVenues`'s `enabled: false` when nothing's queried is what keeps the default
state from firing a request at all.

Recent Searches (`lib/search/useRecentSearches.ts`) is device-local, same "preference, not
user data" category as Saved — deliberately simpler than `SavedRepository`, with no
interface/implementation split, since search history has no plausible future sync target
the way saved venues do.

**Bug caught in browser verification:** the Results count read `Results — 0` during an
error, implying zero results were found rather than that the request failed. Fixed by
gating the count on `results.isSuccess`, not just `!isLoading`.

**Exit:** verified live — default state (Popular Categories, no Recent Searches yet),
category-chip switching, Recent Searches persisting across navigation with a working
"Clear All", and the corrected error-state count all confirmed in the browser. Clean
build/lint/typecheck.

---

## Phase 8 — Explore ⛔

**Blocked on `API_REQUIREMENTS.md` §2** — Collections, Editor's Picks, and Weekend
Planner have no content model in Studio. This is a Studio sprint, not a Consumer one.

**Exit:** all four regions driven by `/public/collections`.

---

## Phase 9 — Saved · More · Splash · Onboarding ✅ complete

- **Saved** — real `useSaved()` + `useVenues()` wiring; only "Favorites" has content,
  Collections/Want to Go are permanent `EmptyState`s (no multi-list model exists), not
  scheduled placeholders. Header sort (recent/A-Z) is a genuine toggle over the real
  list — implemented rather than left as a Phase-4-style inert stand-in, since a real
  two-way sort cost nothing extra to build honestly.
- **More** — application-level items only (Account group dropped per the no-accounts
  decision). Every row is a real destination: Language/Theme are informational-only via
  `ListRowItem`'s new `disabled` mode (one language, one theme exist — nothing to
  navigate to, distinct from an unimplemented feature); About is a real page
  (`/about`, brand copy only); Privacy/Terms route to `/coming-soon` rather than
  inventing legal text no one at SahelSpot has approved; Contact is a real `mailto:`;
  Share uses the real Web Share API with clipboard fallback; Rate App is a feedback
  `mailto:` in the absence of an app-store listing this website doesn't have.
- **Splash** — implemented as `app/loading.tsx`, Next's global route-loading UI, per the
  roadmap's own earlier recommendation against a timed gate that delays first paint.
  Not a dedicated route no one would navigate to.
- **Onboarding** — the 3-slide sequence, gradient placeholders standing in for imagery
  neither Stitch export contains (same treatment as Splash's logo mark). Persists its
  seen-flag via `useOnboardingSeen`. **No auto-redirect wired from Home** — whether first-
  time visitors should be redirected into onboarding is a product decision for a public
  website (unlike a native app's "first launch"), not assumed here; flagged in Open
  decisions below.

Onboarding slide 3 ("Save Your Favorites") is **valid copy** — Saved genuinely ships.

**Exit:** verified live — Saved's tabs, sort toggle, and error/retry state; More's
disabled-vs-real row distinction, About page, and Share confirmation; Onboarding's
3-slide flow confirmed to persist its flag and land on Home. Clean build/lint/typecheck.

---

## Phase 10 — Motion

Framer Motion added only now, per approved guidance. `tap-scale`, `hover-scale`,
scroll-shadow header, sheet transitions, marker-location pulse. All gated on
`prefers-reduced-motion`.

**Exit:** no motion regressions; reduced-motion path verified.

---

## Phase 11 — Accessibility, performance, and QA

**Reordered ahead of Desktop on explicit instruction** — the mobile experience must be
feature-complete and stable before desktop work begins at all; there is no immediate
business need for desktop.

Keyboard traversal of every screen; screen-reader pass; the colour-contrast audit on
`on-surface-variant/60` and 10px labels; Lighthouse; `sitemap.ts`, `robots.ts`, JSON-LD,
per-venue `generateMetadata`; a full functional QA pass across every implemented screen
against real data (revision 1071).

**Exit:** contrast audit passes; no critical a11y findings; Core Web Vitals green; no
known functional defects on mobile.

---

## Phase 12 — Desktop (final phase)

Begins only once Phase 11 is complete and the mobile experience is considered stable —
not on a fixed schedule. Mobile stays frozen throughout; desktop adapts the same design
language per `DESIGN_SYSTEM.md` §3 — bottom nav → top nav, carousels → grids, sheet →
side panel. No new visual vocabulary, no changed type scale, no desktop-only component
variants.

**Exit:** every screen correct at 768 / 1024 / 1440px with no horizontal scroll.

---

## Real-data verification (post-Phase 7, pre-Phase 8)

Publish revision 1071 (25 destinations, 401 venues) landed — the first real content this
project has had. Every screen built so far (4–7) had only ever been verified against `[]`
or hand-built fixture data. This pass re-verified Home, Map, Venue Details, and Search
against the real dataset by feeding real captured JSON through the actual mapper and
components on a temporary route (deleted before commit) — the CORS gap from Phase 3 still
blocks the *browser's own* fetch, so this was the available way to see real content
through real code without touching that out-of-scope config.

**One real bug found and fixed:** the category mapper checked the wire `category` string
against Stitch's five literal names. Real Studio categories are entirely different
strings (`Restaurant`, `Cafe`, `Beach Club`, etc.) — before the fix, every category except
`Nightlife` fell back to `general`, including all 206 restaurants and cafes (51% of the
dataset). Fixed via a translation table — `API_REQUIREMENTS.md` §9.

**One field newly confirmed and implemented:** `opening_hours`'s real shape, from the one
populated venue. `lib/domain/openingHours.ts` now parses it into `isOpenNow` and an
"Until HH:MM" info pill — real coverage is 1/401, so don't expect it visible on more than
a handful of venues yet.

**Confirmed, not assumed:** `cover_image_url`/`gallery_image_urls` are 0/401 — every
image fallback in the app is live today, not theoretical. `is_featured` is 1/401 — Home's
Trending Today is correctly sparse given the data. `beach_details` is 0/401 — still
unresolved whether it's the "Why Visit" source, unconfirmable until a venue has it set.

**Informational, not code changes:** bilingual venue names render via font fallback
(no defect, a future i18n decision); one apparent duplicate venue name pair spotted in
Marassi (a Studio content question).

---

## Critical path

```
0 → 1 → 2 → 3 → 4 (Home) → 5 (Map) → 6 (Details) → 7 (Search) → 9 → 10 → 11 → 12
                                                                  ↑
                                          8 (Explore) blocked on Studio collections
```

**Eight of nine screens are unblocked.** Explore alone waits on a Studio content model,
and it sits off the critical path — every other phase proceeds without it.

---

## Open items

None block Phase 0. None block any phase except Explore.

### 1. 🔴 Studio collections model — blocks Phase 8 (Explore) only
`API_REQUIREMENTS.md` §2. A Studio sprint, not a Consumer one.

### 2. 🟡 Ratings — `API_REQUIREMENTS.md` §1
Ratings appear on essentially every card in the product. Are they editorially curated in
Studio, or aggregated from a review system that does not exist? If the latter, this is a
substantial piece of work and Home ships without rating UI until it lands.

### 3. 🟡 Theme row on More
The approved item list includes "Theme", but Stitch defines one light theme and no dark
mode. Omit the row, or show it disabled? Does not block Phase 0.

### 4. ✅ Resolved — avatar, greeting, and notification bell stay visible
All three are kept at full Stitch visual fidelity in `TopAppBar`; only their
interaction is disabled (no photo behind the avatar, the bell is inert). An
unimplemented feature loses its interaction, not its visual presence — see
`DESIGN_SYSTEM.md` §11.

### 5. 🟡 Weather pill
Recommend dropping from v1 — it is one decorative pill and the only element that would
introduce a second data source, which decision 3 forbids.

### 6. 🟡 Splash screen
A timed splash is a native pattern that delays first paint and harms SEO on the most
important route. Recommend a brand loading state during initial fetch rather than a timed
gate.

### 7. 🟡 Commit the Stitch export
It currently lives in `~/Downloads`, outside version control. The visual source of truth
should be versioned alongside the code.

### 8. 🟢 Confirm the canonical Map
`interactive_map_1` is canonical on evidence, though its title disagrees with the audit
(`STITCH_SOURCE.md`). Confirm before Phase 5.

### 9. 🟡 Category coverage beyond Stitch's five — a product/UX decision, not an API gap
Real Studio data (publish revision 1071) confirmed 11 real venue categories against
Stitch's mood grid and map markers, designed for 5. `Activity`/`Shopping`/`Spa`/`Hotel`/
`Services`/`Resort`/`Other` — 168 venues, 42% of the dataset — have no Stitch-designed
chip or marker colour and correctly render as `general`. The API is not at fault; `category`
is valid, published data throughout. The open question is purely product/UX: does the
mood grid gain a 6th "More" chip, do markers get more colours, or does `general` stay the
intentional catch-all? See `API_REQUIREMENTS.md` §9 for the mapping table and the bug this
was fixed alongside.

### 10. 🟡 Should first-time visitors be redirected into Onboarding?
Onboarding (Phase 9) is built and reachable at `/onboarding`, but nothing currently sends
a first-time visitor there automatically. The spec describes it as "first-launch-only,"
which is a native-app framing; gating a public website's homepage behind a 3-slide
sequence for new visitors is a real UX/SEO trade-off (bounce risk, an extra step before
the content search engines actually want to index), not something to assume. Options: (a)
client-side redirect from `/` to `/onboarding` when `useOnboardingSeen` is false, (b) leave
it reachable only via a direct link/future "Help" entry point, never auto-shown. No
redirect is wired today — option (b) by default, pending a decision.
