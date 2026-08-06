# SahelSpot Mobile 2027 — Implementation Readiness Audit

Compares the real, current state of `consumer/` (Next.js 16 / React 19 / Tailwind v4) against the frozen [MOBILE_2027_DESIGN_FREEZE.md](MOBILE_2027_DESIGN_FREEZE.md). Findings below are drawn from the actual source files, not from documentation claims — several existing docs (`COMPONENT_INVENTORY.md`, `DESIGN_TOKENS.md`) are stale relative to the code and should be re-verified against this audit before being trusted.

This is a research artifact only. No code was written or modified to produce it.

---

## 1. READY

Already matches the frozen design system, or is correctly out of scope for this migration. No action needed.

- **Route/shell architecture.** The `(root)` and `(push)` route groups (`app/(root)/layout.tsx`, `app/(push)/layout.tsx`) already implement exactly the three-shell structure the freeze report assumes: root-tab shell with `BottomNav`, push shell with none. `BottomNav` is structurally rendered *only* inside `(root)/layout.tsx` — it is architecturally impossible for it to leak onto a push screen. This is exactly right and should not be touched.
- **9 canonical routes exist and map correctly**, plus three screens beyond the original 9 (`/events`, `/events/[slug]`, `/about`, `/coming-soon`) that are out of scope for this freeze — flag but do not touch.
- **Navy primary token is already correct.** `app/globals.css` `@theme` block: `--color-primary: #0d3b66` — matches the frozen system's navy almost exactly, no change needed to this token's value.
- **Icon system already matches.** Material Symbols Outlined is the real, actively-used icon system (`components/ui/Icon.tsx`), consistent with the frozen system's icon style. Lucide is installed but only as a documented fallback for the rare glyph Material lacks — leave as-is.
- **DTO → Mapper → Domain data flow is real and correctly layered** (`lib/api/dto.ts` → `lib/domain/mappers/*` → `lib/domain/*` → `lib/hooks/use*`). This has nothing to do with visual language and should not be touched by this migration.
- **State management is appropriately minimal** — TanStack Query for server state, a clean `SavedRepository` interface/localStorage pattern for saved venues, no unnecessary state library. Not in scope.
- **Light-only theme is a documented, deliberate decision** on both sides — `globals.css` explicitly has no dark mode, and the freeze report's Deferred Improvements section defers dark mode. Consistent; no action needed.
- **Mobile-only responsive scope is consistent on both sides** — no `md:` breakpoints exist in the app today, and the freeze report defers desktop adaptation to Phase 11. Consistent; no action needed now.

---

## 2. REQUIRES MODIFICATION

Specific, targeted changes — listed from lowest-level (tokens) to highest-level (screens), each with exactly what needs to change and why.

### Design tokens (`app/globals.css` `@theme` block)
- `--color-secondary: #2aa198` (teal) and `--color-tertiary: #f28705` (orange) must be retired. The frozen system has exactly one accent: Summer Yellow `#FFC94A`. Every current usage of `text-secondary`, `bg-secondary`, `text-tertiary`, `bg-tertiary` etc. needs auditing — some are legitimate accent points (save/active states) that should become yellow; others may be incidental and should collapse to navy/neutral once the second and third brand colors are gone.
- No headline-font token exists. Need a `--font-headline` (Space Grotesk) alongside the existing `--font-inter` body token.
- `--color-pin-nightlife` / `--color-pin-coffee` (map category marker colors) — frozen system's Map spec requires navy-only markers (see freeze report §7 note on Interactive Map's yellow-discipline fix); these category-color tokens conflict with that and need reconciling.
- `--color-whatsapp: #25d366` — this is a correctly-scoped exception (real brand color override, documented in `COMPONENT_INVENTORY.md` as the one place a brand mark overrides the icon system) and should **not** be changed.

### Typography
- No Space Grotesk is loaded anywhere. `app/layout.tsx` needs a second `next/font/google` import for Space Grotesk, wired to the new `--font-headline` token. Current headline treatment is just heavier-weight Inter (`font-black`/`font-bold`) — every heading/card-name/section-header usage needs to switch font-family, not just weight.

### Cards (`components/venue/VenueCard.tsx`, `components/destination/DestinationCard.tsx`, `components/event/EventCard.tsx`, `components/editorial/CollectionCard.tsx` / `FeatureCard.tsx`)
- **Save affordance is in the wrong position and wrong construction.** Current: a circular `IconButton` top-*right* with a `favorite` (heart) glyph, filled `text-tertiary` (orange) when active. Frozen spec: filled yellow circular badge, top-*left*, navy *bookmark* icon — fixed position/shape/icon across the whole card system. This needs to change in `VenueCard.tsx` and anywhere else the save action renders.
- **No yellow corner accent exists on any card.** The frozen 5-variant system requires a small yellow triangular corner-accent mark on every card — currently absent everywhere.
- **Panel construction differs.** Frozen spec: info panel floats, inset from the photo's edges, reading as a distinct object placed over the image. Current `VenueCard` (`vertical-lg`/`vertical-compact`) uses a conventional bordered/shadowed card with the image as a top region, not a floating-panel-over-photo construction. This is the biggest single visual gap and needs care to get right without altering the component's variant-prop API (see §3 — the API itself is good).
- **`DestinationCard.tsx`** is closer to spec already (full-bleed image, gradient scrim, bottom-left text) but its accent usage (`text-cream`) and any teal/orange touches need to move to the single-yellow system, and it should pick up the same corner-accent/save-badge treatment as other card variants for family consistency.
- **`CollectionCard`, `FeatureCard`, `EventCard`** need to be explicitly reconciled against the frozen system's 5 named variants (Featured / Standard / Compact Horizontal / Search Result / Event) — right now there may be more distinct card components in code than the frozen system defines variants for. Decide the mapping before touching code (this may be a "stop and ask" point if the mapping isn't 1:1 obvious).

### Search (`components/patterns/SearchField.tsx`)
- Needs to become the "Layered Dock Search" construction: card-family corner radius (not a full pill), a visible yellow structural base peeking from one edge, and a separate solid-yellow filter capsule as its own docked object rather than an inline icon. Current construction wasn't fully read in this pass — a close read of `SearchField.tsx` is needed before writing the change (see Implementation Order).

### Section headers (`components/patterns/SectionHeader.tsx`)
- Needs the fixed small yellow underline/tick mark added beneath every section title. Currently plain navy text per the audit. Low-risk, single-component, high-reuse change.

### Bottom navigation (`components/nav/BottomNav.tsx`)
- Active-tab treatment currently has **no indicator shape at all** — just `text-primary` color + Material Symbols FILL-1 on the icon, no pill, no circle, but also no underline. This actually needs the thin yellow underline *added* (not removed, since there's no pill to remove here — this codebase never had the heavy circular treatment the Stitch exploration went through). Also needs the icon/label color source switched from navy to yellow when active, per frozen §3.4.
- Tab set/order/labels (`lib/navigation.ts` `ROOT_TABS`) already exactly match: Home, Explore, Map, Saved, More. No structural change needed, styling only.

### Status badges (`components/patterns/StatusBadge.tsx`)
- Needs a color/token check against frozen badge spec (Featured/CLOSED/Upcoming) once the token migration lands — likely inherits correctly if it already uses semantic tokens, but must be explicitly verified, not assumed.

### Map markers (`components/map/createMarkerElement.ts`, `createClusterElement.ts`)
- Category-color-coded markers need to move to navy-only per the frozen yellow-discipline rule for the Map screen (see freeze report §7).

---

## 3. SHOULD BE REUSED

Well-built production code — adapt in place, do not rewrite.

- **`components/venue/VenueCard.tsx`'s variant-prop architecture.** One component, three variants (`vertical-lg`, `vertical-compact`, `horizontal-row`) driven by a `variant` prop, explicitly documented as covering Home Trending, Saved list, Map bottom sheet, Venue Details Nearby Places, and Search results. This is exactly the right shape for the frozen system's "one family, size/density varies by variant" rule — **do not split this into multiple components.** Restyle the existing variants in place.
- **The route-group shell architecture** (`(root)`/`(push)` layouts) — structurally enforces the nav-presence rule better than a convention or prop ever could. Reuse as-is.
- **`lib/saved/*`** (repository interface + localStorage implementation + `useSaved` hook) — clean separation, already isolated so a future authenticated backend can replace it without touching UI. Not a visual concern; leave untouched.
- **The DTO/Mapper/Domain/Hook data-flow layers** (`lib/api/*`, `lib/domain/*`, `lib/hooks/*`) — correctly layered, has zero coupling to visual presentation. This migration should never need to touch these files.
- **`components/ui/Icon.tsx`** — thin, correct wrapper around Material Symbols with the FILL-1 active-state pattern already solved. Reuse as-is; only the *colors* passed to icons change, not this component.
- **`QueryProvider.tsx` / TanStack Query setup** — correctly configured, unrelated to visual migration.
- **`app/(root)/layout.tsx` / `app/(push)/layout.tsx` structure** — reuse as-is; only the components they render (`BottomNav`) need internal restyling, not the layouts themselves.

---

## 4. IMPLEMENTATION ORDER

Lowest-level to highest-level, matching the requested safest-sequence shape. Each screen is built and verified against its canonical Stitch render before starting the next, per the standing implementation workflow — this order is the dependency chain that makes that possible without rework.

```
1. Design Tokens
   app/globals.css @theme block — retire secondary/tertiary (teal/orange),
   introduce single --color-accent-yellow (#FFC94A), add --font-headline
   token slot. This is the single highest-leverage change: every component
   using semantic Tailwind classes (text-primary, bg-tertiary, etc.)
   inherits automatically once tokens are correct.

2. Typography
   app/layout.tsx — load Space Grotesk via next/font/google, wire to
   --font-headline. Audit every heading/card-name/section-header class
   list to switch font-family, not just weight.

3. Icons
   No structural change (Material Symbols already correct). Verify no
   component was silently relying on the retired teal/orange tokens for
   icon color.

4. Buttons & Badges
   components/ui/CTAButton.tsx, IconButton.tsx, Pill.tsx,
   components/patterns/StatusBadge.tsx — verify token inheritance after
   step 1; fix any hardcoded (non-token) color reference found.

5. Cards
   components/venue/VenueCard.tsx first (highest reuse surface — Home,
   Saved, Map, Venue Details, Search all depend on it), then
   DestinationCard.tsx, then reconcile CollectionCard/FeatureCard/EventCard
   against the frozen 5-variant map (stop and ask if the mapping isn't
   1:1 obvious). Save-badge reposition (top-left, yellow, bookmark icon)
   and corner-accent addition happen here.

6. Search
   components/patterns/SearchField.tsx — Layered Dock construction.
   Read the current implementation in full before writing the change.

7. Section Headers
   components/patterns/SectionHeader.tsx — add the yellow underline mark.
   Single component, every screen inherits it.

8. Navigation
   components/nav/BottomNav.tsx — add the yellow underline active-state
   treatment per freeze report §3.4.

9. Layout
   Verify (root)/(push) layouts still compose correctly with the restyled
   BottomNav/SearchField/SectionHeader — expect no structural change,
   confirmation pass only.

10. Screens
    One at a time, per the standing workflow (read freeze report → read
    canonical Stitch screen → build → diff → fix → move on). Suggested
    screen order: Home → Saved → Explore → Venue Details → Search →
    Map → More, roughly matching root-tab-shell screens first (most
    shared-component reuse) before push-shell screens, Map last within
    that group given its category-marker rework and the Mapbox substrate
    complexity already flagged in the freeze report.
```

---

*This audit does not authorize implementation. It is the roadmap referenced by the Design Guardian workflow — implementation begins only when explicitly instructed, one screen at a time, per the rules already in force.*
