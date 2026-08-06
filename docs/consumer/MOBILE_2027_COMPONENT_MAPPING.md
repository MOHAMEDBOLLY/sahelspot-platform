# SahelSpot Mobile 2027 — Component Mapping Audit

The migration blueprint. Maps every real `consumer/` UI component to its frozen [MOBILE_2027_DESIGN_FREEZE.md](MOBILE_2027_DESIGN_FREEZE.md) equivalent, building on [MOBILE_2027_IMPLEMENTATION_AUDIT.md](MOBILE_2027_IMPLEMENTATION_AUDIT.md). No code was written or modified to produce this document. Once approved, no component may be touched during implementation without first locating it in the table below.

---

## 1. Component Mapping Matrix

| Current Component | File Path | Current Responsibility | Frozen Equivalent | Action |
|---|---|---|---|---|
| `VenueCard` | `components/venue/VenueCard.tsx` | One component, 3 variants (`vertical-lg`, `vertical-compact`, `horizontal-row`) covering Home, Saved, Map sheet, Venue Details, Search | Standard Card (v-lg/compact) + Compact Horizontal Card (row) | **RESTYLE** (architecture is correct — see §3) |
| `CollectionCard` | `components/editorial/CollectionCard.tsx` | Explore's 2×2 bento grid — image + label only | Standard Card, low-density sub-treatment | **EXTEND** |
| `FeatureCard` | `components/editorial/FeatureCard.tsx` | Explore Editor's Picks + Weekend Planner banner, one component via props | Featured Card | **RESTYLE** |
| `EventCard` | `components/event/EventCard.tsx` | Own docstring: "adapted from `VenueCard`'s `vertical-lg` layout" | Event Card (defined as "same construction as Standard Card + additive status/date") | **MERGE** into `VenueCard` as a 4th variant |
| `SearchField` | `components/patterns/SearchField.tsx` | `solid`/`glass` variants for Home/Search vs Map | "Layered Dock Search" | **RESTYLE** (KEEP the variant-prop architecture) |
| `BottomNav` | `components/nav/BottomNav.tsx` | 5-tab root nav, structurally render-guaranteed by route group | Bottom Navigation, underline active-state | **RESTYLE** |
| `SectionHeader` | `components/patterns/SectionHeader.tsx` | Title + optional "See All", 2 sizes | Section Header w/ yellow underline mark | **RESTYLE** |
| `StatusBadge` | `components/patterns/StatusBadge.tsx` | OPEN/CLOSED badge on every `VenueCard` | Status badge | **KEEP** as the canonical impl — see duplicate below |
| `Pill` (variant=`status`) | `components/ui/Pill.tsx` | A *second*, independently-implemented OPEN/CLOSED badge | Same status badge concept | **DEPRECATE** this variant — duplicates `StatusBadge` |
| `Pill` (variant=`weather`) | `components/ui/Pill.tsx` | Home hero weather pill ("31°C Sunny") | Weather pill (frozen: restyled only, kept as-is functionally) | **RESTYLE** (token colors only) |
| `Pill` (variant=`tag`) | `components/ui/Pill.tsx` | Venue Details tag pills ("Beach Club") | No distinct frozen equivalent named — generic tag pill | **RESTYLE** (token colors only) |
| `Pill` (variant=`counter`) | `components/ui/Pill.tsx` | Gallery position counter ("1/15") | Not part of card/nav/search system — orthogonal utility | **KEEP** |
| `CTAButton` | `components/ui/CTAButton.tsx` | Filled pill CTA, primary/secondary | Primary/secondary buttons | **KEEP** (token-only inheritance) |
| `IconButton` | `components/ui/IconButton.tsx` | All icon-only controls; 4 variants (`solid`/`glass`/`outlined`/`plain`); already has the correct 48dp-tap-target/required-label accessibility fixes | Save affordance (filled yellow circle, navy bookmark) + other floating/in-flow icon controls | **EXTEND** — add one new variant for the filled-yellow save badge; do **not** touch `solid`/`glass`/`outlined`/`plain`, which serve other correct use cases (hero back/share, map locate/layers, Venue Details call/WhatsApp/website) |
| `IconActionButton` | `components/ui/IconActionButton.tsx` | Outlined in-flow action row — Venue Details call/WhatsApp/website | No named frozen equivalent — orthogonal to card/nav/search system | **KEEP** |
| `Icon` | `components/ui/Icon.tsx` | Material Symbols Outlined wrapper, FILL-1 active-state handling | Icon style (already matches — Material Symbols Outlined) | **KEEP** |
| `CategoryChip` | `components/patterns/CategoryChip.tsx` | Home mood grid + Search Popular Categories — square cream tile | Chips | **RESTYLE** (token colors only) |
| `FilterChip` | `components/patterns/FilterChip.tsx` | Map category row + Search filter row — pill, navy-fill active | Chips, active state | **RESTYLE** (active-state color: frozen spec is navy fill + **yellow** text, current is navy fill + white text) |
| `QuickBrowseChip` | `components/patterns/QuickBrowseChip.tsx` | Explore Quick Browse — circular white tile, explicitly justified as a distinct shape from `CategoryChip` in its own docstring | Chips | **RESTYLE** (token colors only) |
| `createMarkerElement` / `createUserLocationElement` | `components/map/createMarkerElement.ts` | Category-color-coded venue pins + navy user-location dot (plain DOM, Mapbox requirement) | Map markers — frozen spec is navy-only, no category colors | **RESTYLE** (remove category color-coding, navy fill only; KEEP the plain-DOM factory-function architecture) |
| `createClusterElement` | `components/map/createClusterElement.ts` | Cluster bubble, color = navy for "All" filter, category color when a filter is active | Map markers — navy-only | **RESTYLE** (remove the color-by-active-filter branch; always navy) |
| `MapControls` | `components/map/MapControls.tsx` | Floating layers/locate-me buttons | Floating map controls | **KEEP** (not yet read in detail — verify at implementation time, but no flagged conflict) |
| `createPreviewChipElement` | `components/map/createPreviewChipElement.ts` | Active-venue marker morph | No frozen equivalent documented — Stitch's map is a static illustration, this is real-Mapbox-only behavior | **KEEP** (out of visual-language scope) |
| `RatingBadge` / `RatingStars` | `components/ui/RatingBadge.tsx`, `RatingStars.tsx` | Rating display on cards/Venue Details | Not explicitly restyled in the freeze report | **KEEP** (verify token inheritance only) |
| `Avatar` | `components/ui/Avatar.tsx` | Home header avatar circle | Header avatar | **KEEP** |
| `TopAppBar` | `components/nav/TopAppBar.tsx` | Sticky header, `greeting`/`title` variants | Header (greeting/location/weather on Home; title elsewhere) | **KEEP** structurally, **RESTYLE** tokens only — not flagged for construction changes in the freeze report |
| `BottomSheet` | `components/patterns/BottomSheet.tsx` | Map's draggable sheet | Map bottom sheet | **KEEP** (not visually respecified) |
| `CardCarousel` | `components/patterns/CardCarousel.tsx` | Horizontal snap-scroll wrapper used by every card rail | Carousel rows throughout | **KEEP** (layout-only, no visual identity of its own) |
| `ChecklistRow`, `InfoPill`, `ListRowItem`, `TabBar`, `EmptyState`, `PageDots`, `StatTile` | `components/patterns/*` | Various — Venue Details checklist, info pills, More's list rows, Saved's segmented tabs, empty states, Onboarding dots, Map sheet stats | No explicit conflicts identified in the freeze report | **KEEP**, RESTYLE tokens only where they render color |
| `LogoLockup` | `components/brand/LogoLockup.tsx` | Splash/loading logo | Splash | **KEEP** |
| `DestinationCard` | `components/destination/DestinationCard.tsx` | Home Explore Destinations grid — gradient scrim, km label, place count | Standard Card variant (destination content) | **RESTYLE** |

---

## 2. Migration Strategy

1. **Token-level changes cascade first and cheaply.** The majority of the "RESTYLE" rows above only need `app/globals.css`'s `@theme` block to change (secondary/tertiary → single yellow accent, add headline font token) — components using semantic classes (`text-primary`, `bg-tertiary`, etc.) inherit automatically. Do this once, first, per the Implementation Audit's order.
2. **Resolve the two real duplicates before restyling anything that touches them:** `StatusBadge` vs. `Pill`'s `status` variant. Find every current consumer of `Pill variant="status"` (if any exist beyond `VenueCard`, which actually imports `StatusBadge` directly), redirect them to `StatusBadge`, then remove the `status` case from `Pill`'s variant map.
3. **Merge `EventCard` into `VenueCard` as a new variant**, not a copy-paste restyle of both. `EventCard`'s own docstring already admits it's a derivative of `vertical-lg` with the save/rating rows stripped and a featured badge + date row added — this is precisely what a 4th `VenueCard` variant should express, not a parallel component that will drift from `VenueCard` on the next change.
4. **`IconButton` gets a new variant, not a rewrite.** The save-badge treatment (filled yellow circle, navy bookmark, top-left) is visually unlike any of `IconButton`'s existing 4 variants — add a 5th (e.g. `accent`) rather than repurposing `solid`, which is correctly shared by hero back/share buttons and other floating controls that must NOT turn yellow.
5. **`CollectionCard` stays a separate, smaller component**, not folded into `DestinationCard` — its content model (label + image only, no subtitle, no place count) is genuinely simpler, and merging would force one of the two to grow an unused optional field. Extend it with the corner-accent/save-badge family treatment for visual consistency without collapsing the component boundary.
6. **Map markers and Search/Filter chip active-states need a `#FFC94A` audit independent of the token swap** — these are inline JS-computed styles (`createMarkerElement.ts`, `createClusterElement.ts`) and Tailwind classes with hardcoded intent (`bg-primary text-white` on active `FilterChip`, which the frozen system wants recolored to navy-fill + **yellow** text), so they will not silently inherit from the token change alone and must be visited explicitly.
7. **Everything marked KEEP should not be opened during this migration** unless a screen-level diff against its canonical Stitch render turns up a real discrepancy — don't preemptively touch working, correctly-architected code.

---

## 3. Components Requiring Zero Changes

- `Icon.tsx` — icon system already matches (Material Symbols Outlined).
- `IconActionButton.tsx` — orthogonal utility, no frozen-system conflict.
- `CTAButton.tsx` — architecture and variants are correct; inherits token changes automatically.
- `Avatar.tsx`, `BottomSheet.tsx`, `CardCarousel.tsx`, `LogoLockup.tsx`, `createPreviewChipElement.ts`, `MapControls.tsx`, `RatingBadge.tsx`, `RatingStars.tsx`.
- `Pill` (`counter` variant only) — gallery position counter, no visual conflict.
- The route-group shell architecture (`(root)/layout.tsx`, `(push)/layout.tsx`) and every data-flow layer (`lib/api/*`, `lib/domain/*`, `lib/hooks/*`, `lib/saved/*`) — confirmed in the Implementation Audit, restated here for completeness since they are, in effect, "components" of the system this document is mapping.

---

## 4. Components Requiring Only Visual Restyling

Token/color/spacing-class changes, no structural change to props, variants, or markup shape:

- `SectionHeader.tsx` — add yellow underline mark.
- `BottomNav.tsx` — add underline active-state, swap active color source to yellow.
- `SearchField.tsx` — Layered Dock construction (radius, yellow structural base, docked filter capsule).
- `CategoryChip.tsx`, `QuickBrowseChip.tsx` — cream/token color updates.
- `FilterChip.tsx` — active-state text color (white → yellow).
- `Pill.tsx` (`weather`, `tag` variants) — token color updates.
- `DestinationCard.tsx`, `FeatureCard.tsx` — token colors + add corner-accent/save-badge family treatment.
- `createMarkerElement.ts`, `createUserLocationElement`, `createClusterElement.ts` — navy-only marker fills.
- `VenueCard.tsx` — save-badge reposition/recolor, corner-accent addition, panel construction adjustment (largest single restyle in scope, but zero prop/variant API changes).
- `TopAppBar.tsx` and the remaining `components/patterns/*` list from §1 — token colors only, pending confirmation at screen-diff time.

---

## 5. Components Requiring Structural Extension

- `IconButton.tsx` — **EXTEND**: add one new variant for the filled-yellow save badge. Existing 4 variants (`solid`/`glass`/`outlined`/`plain`) stay untouched.
- `VenueCard.tsx` — **EXTEND** (in the same motion as its RESTYLE, and as the MERGE target for `EventCard`): add a 4th variant absorbing `EventCard`'s responsibility (featured badge, date row, phase tag; no save/rating rows).
- `CollectionCard.tsx` — **EXTEND**: pick up the corner-accent/save-badge family markup while keeping its simpler, label-only content model.

---

## 6. Components to Retire

- `EventCard.tsx` — retire the file once its one responsibility is folded into `VenueCard` as a new variant. Update the two consumers (`EventsListClient.tsx`, `EventDetailsClient.tsx`, per the Implementation Audit's route list) to call `VenueCard` with the new variant instead.
- `Pill.tsx`'s `status` variant — retire this case from the variant map once its (if any) consumers are confirmed and redirected to `StatusBadge.tsx`. The `Pill` component itself is not retired — only this one duplicated variant.

No other component is recommended for full retirement. Nothing in this codebase should be deleted wholesale; the two items above are internal deduplication, not scope reduction.

---

## 7. Risks

- **`IconButton`'s `solid` variant is shared by unrelated controls** (hero back/share buttons, map locate/layers, the current save button). Adding the new accent variant must be additive — any accidental edit to the `solid` case itself would silently reskin controls that were never meant to turn yellow. Verify with a project-wide usage search before touching `IconButton.tsx`.
- **Token cascade has broad, hard-to-fully-preview blast radius.** Retiring `--color-secondary`/`--color-tertiary` will change the rendered color of every class reference to them across the whole app in one commit — a systematic grep for `text-secondary`, `bg-secondary`, `text-tertiary`, `bg-tertiary`, `-container` variants of each, etc. is required before the token swap, not after, so nothing is missed silently.
- **`EventCard` → `VenueCard` merge touches two live routes** (`/events`, `/events/[slug]`) that sit outside the original 9 canonical screens — confirm their current content/behavior isn't accidentally altered by the variant merge, since they were not part of the Stitch design-freeze process at all.
- **`CollectionCard`, `FeatureCard`, and the Explore screen generally are blocked on the Studio collections content model** (per `docs/consumer/API_REQUIREMENTS.md` §2, cited directly in both components' own docstrings). Restyling ahead of that backend gap is safe and won't be blocked, but functional/content completeness for these sections remains out of this migration's control.
- **Map markers are real Mapbox GL DOM elements, not Stitch-style static illustration** — the freeze report already flags this screen as highest-risk for exactly this reason. Marker restyling must be verified by running the actual app, not by comparing to the canonical Stitch Map screenshot, which shows a static substrate that doesn't exist in production.
- **No component-level deletion/rename should happen ahead of confirming zero remaining references** — particularly for `EventCard.tsx` and `Pill`'s `status` variant. A stale import anywhere would be a build break, not a visual bug.

---

## 8. Estimated Implementation Complexity

| Area | Complexity | Why |
|---|---|---|
| Design tokens (`globals.css`) | **Low** | Single file, but requires the grep-first discipline noted in Risks |
| Typography (Space Grotesk) | **Low** | One new `next/font` import + token wiring; then a pass to swap font-family classes on headline-bearing elements |
| Icons | **Low** | No change required, verification pass only |
| Buttons/Badges (`CTAButton`, `IconButton` extension, `StatusBadge`/`Pill` dedup) | **Medium** | Mostly low, but the `IconButton` extension and the `StatusBadge`/`Pill` duplicate resolution both require careful usage auditing first |
| Chips (`CategoryChip`, `FilterChip`, `QuickBrowseChip`) | **Low** | Token-only changes, no structural risk |
| Cards (`VenueCard` restyle + `EventCard` merge, `DestinationCard`, `CollectionCard`, `FeatureCard`) | **High** | Largest surface area, the one true structural merge, the save-badge reposition affects the most-reused component in the app, and content-model gaps (Collections/Editor's Picks) add uncertainty |
| Search (`SearchField`) | **Medium** | Visually the biggest single-component change (Layered Dock construction) but confined to one file with a clean variant API already in place |
| Navigation (`BottomNav`) | **Low** | Small, isolated, already has the correct render-guarantee architecture — only the active-state visual needs adding |
| Map markers (`createMarkerElement`, `createClusterElement`) | **Medium** | Simple color-logic change, but must be verified against the real Mapbox runtime, not a static mock |
| Layout / screens (final assembly + per-screen diff pass) | **Medium–High** | Mechanically straightforward once the above land, but the "one screen at a time, diff against canonical, fix before moving on" workflow is inherently a multi-pass, verification-heavy phase across all 9 screens |

**Overall project complexity: Medium-High** — driven almost entirely by the Cards area (the true structural work) and the verification discipline required everywhere else; most individual components are Low-to-Medium in isolation.

---

---

## Approval Notes (binding, appended at sign-off)

1. `EventCard` merges into `VenueCard` as an official variant. No standalone `EventCard` component remains after migration — not deprecated-but-present, fully folded in.
2. `StatusBadge` vs. `Pill`'s `status` variant: **deprecation precedes removal.** The `Pill` `status` case may be marked deprecated once its usage is being migrated, but must not be deleted until a codebase-wide search confirms zero remaining references.
3. `CollectionCard` stays an independent component permanently — not a future `VenueCard` variant under any circumstance. It inherits the shared visual language (color tokens, corner-accent, typography) while keeping its simpler, label+image-only responsibility.
4. `SearchField` is a **visual reconstruction**, not a color-only restyle — the "Layered Dock Search" construction (radius, yellow structural base, docked filter capsule) must be rebuilt to match the frozen component. The existing props API and interaction/focus model are preserved exactly; only the rendered visual construction changes.
5. **No component may contain a hard-coded visual color.** Every color used anywhere in the implementation must resolve through a Design Token (`app/globals.css` `@theme` block / CSS custom property), never a literal hex value or an arbitrary Tailwind color utility outside the token system. This applies retroactively to every RESTYLE/EXTEND/MERGE item in this document, not only to new code.

*This document is the approved implementation blueprint referenced by the Design Guardian workflow. No component may be modified during implementation without first being located in the mapping table above.*
