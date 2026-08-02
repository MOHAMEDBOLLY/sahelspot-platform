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

## Phase 7 — Search ✅ unblocked

`VenueCard/horizontal-row` is now fully specified, which was the only gap.

**Exit:** all four states correct against `/public/search/venues`.

---

## Phase 8 — Explore ⛔

**Blocked on `API_REQUIREMENTS.md` §2** — Collections, Editor's Picks, and Weekend
Planner have no content model in Studio. This is a Studio sprint, not a Consumer one.

**Exit:** all four regions driven by `/public/collections`.

---

## Phase 9 — Saved · More · Splash · Onboarding ✅ unblocked

- **Saved** — `SavedRepository` + `LocalStorageSavedRepository`, `useSavedVenues()`
  hook, `TabBar` with Favorites populated and the other two tabs as `EmptyState`
- **More** — application-level items only (Preferences / About / Support / Share)
- **Splash · Onboarding** — unblocked except for the logo asset

Onboarding slide 3 ("Save Your Favorites") is **valid copy** — Saved genuinely ships.

**Exit:** saved state survives reload; no `localStorage` access outside the service;
Onboarding shows once and persists its flag.

---

## Phase 10 — Motion

Framer Motion added only now, per approved guidance. `tap-scale`, `hover-scale`,
scroll-shadow header, sheet transitions, marker-location pulse. All gated on
`prefers-reduced-motion`.

**Exit:** no motion regressions; reduced-motion path verified.

---

## Phase 11 — Desktop

Mobile is complete and frozen first. Desktop adapts the same design language per
`DESIGN_SYSTEM.md` §3 — bottom nav → top nav, carousels → grids, sheet → side panel. No
new visual vocabulary, no changed type scale, no desktop-only component variants.

**Exit:** every screen correct at 768 / 1024 / 1440px with no horizontal scroll.

---

## Phase 12 — Accessibility and performance

Keyboard traversal of every screen; screen-reader pass; the colour-contrast audit on
`on-surface-variant/60` and 10px labels; Lighthouse; `sitemap.ts`, `robots.ts`, JSON-LD,
per-venue `generateMetadata`.

**Exit:** contrast audit passes; no critical a11y findings; Core Web Vitals green.

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

### 5. 🟡 Splash screen
A timed splash is a native pattern that delays first paint and harms SEO on the most
important route. Recommend a brand loading state during initial fetch rather than a timed
gate.

### 6. 🟡 Commit the Stitch export
It currently lives in `~/Downloads`, outside version control. The visual source of truth
should be versioned alongside the code.

### 7. 🟢 Confirm the canonical Map
`interactive_map_1` is canonical on evidence, though its title disagrees with the audit
(`STITCH_SOURCE.md`). Confirm before Phase 5.
