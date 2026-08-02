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

## Phase 4 — Home 🎯

The first complete screen and the validation of everything above. Reference:
`sahelspot_home/code.html`.

**Exit:** pixel-comparable to `sahelspot_home/screen.png` at 390px, using only real
`/public/*` data. Sections with unmet API requirements render their empty state rather
than fabricated content.

---

## Phase 5 — Map 🎯

Moved ahead of Explore: it is the highest-risk screen and it is fully unblocked, whereas
Explore is blocked on a content model that does not exist.

Reference: `interactive_map_1/`. Mapbox GL JS, dynamically imported, `ssr: false`.
Category-coloured markers, glass search, filter chips, floating controls, bottom sheet
with `StatTile`s and Popular Nearby.

**Exit:** real venue coordinates render as correctly coloured markers; sheet opens,
closes, and is keyboard-accessible; the GL bundle is absent from every other route.

---

## Phase 6 — Venue Details ✅ unblocked

Reference: `/Users/Nabil/Downloads/stitch_sahelspot 2/`. Fully specified.

**Exit:** matches the exported screen; contact actions, gallery, save control, and 404
all work; no bottom nav; `px-4` padding.

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
