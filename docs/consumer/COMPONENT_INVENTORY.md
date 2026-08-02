# Consumer — Component Inventory

26 components in four layers. A component may only import from its own layer or below —
this is what keeps the hierarchy from collapsing into mutual dependency.

```
Layer 4  Features    map/ (isolated module)
Layer 3  Composite   VenueCard, DestinationCard, ImageGallery, BottomSheet, …
Layer 2  Patterns    BottomNav, TopAppBar, SearchField, TabBar, SectionHeader, …
Layer 1  Primitives  CTAButton, IconFAB, Pill, Skeleton, RatingStars, …
```

Layer 1–2 components are pure presentation: no data fetching, no API types. Domain types
enter at Layer 3.

---

## Layer 1 — Primitives

### `CTAButton`
`variant: 'primary' | 'secondary'` · `size: 'md' | 'lg'` · `fullWidth` · `icon`
Primary = filled navy pill, white text, `h-12 rounded-full font-bold shadow-md`.
Secondary = white pill, navy text.
Used: Venue Details "Directions", Explore "View Collection" / "Open Calendar",
Onboarding "Next"/"Get Started", `EmptyState`.
Renders `<button>` or, with `href`, a Next `<Link>`.

### `IconActionButton`
`icon` · `label` · `tint?`
Outlined circular action — `w-12 h-12 rounded-full border-2 border-outline-variant/20`,
navy glyph, `active:bg-surface-container`. Distinct from `IconFAB`, which is filled and
floats over imagery. Venue Details action row (call / WhatsApp / website).

**WhatsApp is an inline brand SVG at `#25D366`**, not a Material Symbol — the one place
in the product where a brand mark overrides the icon system.

### `IconFAB`
`icon` · `label` (required, becomes `aria-label`) · `variant: 'solid' | 'glass'`
**48×48dp, no smaller variant** — this is the fix for the 40px instances in the canonical
screens. Glass = `bg-white/95 backdrop-blur`.
Used: hero back/share/save, header bell, map locate/layers, sheet close, Saved sort.

### `Pill`
`variant: 'tag' | 'weather' | 'counter'`
Tag = cream bg / navy text (Venue Details). Weather = secondary-container (Home).
Counter = `black/40`, white text ("1/15").

### `RatingStars`
`value` · `reviewCount`
Order is **numeric first**: `4.8` (`text-brand-gold font-bold text-lg`) → 5 gold star
glyphs → `(230 reviews)` (`text-on-surface-variant text-sm`). Stars support half
values via the `star_half` glyph — full/half/empty, not full/empty. The star row is
`aria-hidden`; the numeric value and count carry the meaning. Venue Details only.

### `RatingBadge`
Compact ★ + number. Used on every card variant.

### `Skeleton`
`variant` matching the card shapes it stands in for. Shimmer respects
`prefers-reduced-motion`.

### `PageDots`
`count` · `activeIndex`. Active dot elongates to `w-6 h-2`; inactive `w-2 h-2` grey.
Onboarding only. Distinct from `Pill/counter`.

### `LogoLockup`
`size` · `showTagline`. Mark + wordmark + EN tagline + AR tagline (`dir="rtl"`,
IBM Plex Sans Arabic). Splash only. **Blocked on the logo asset.**

---

## Layer 2 — Patterns

### `BottomNav`
5 tabs: **Home, Explore, Map, Saved, More** — the fifth is labelled "More" with a `menu`
(hamburger) icon, not "Profile". Icons: `home`, `explore`, `map`, `favorite`, `menu`.
Active = `FILL 1` icon + `text-primary`; inactive = `on-surface-variant` at 70% opacity.
Container: `rounded-t-3xl`, `pt-3 pb-6`, `border-t border-outline-variant/20`,
`shadow-nav`. Body reserves `pb-24`.
Byte-for-byte the most consistent element in the Stitch project — **built first**.
Rendered by the root-tab layout only, never by a screen. Above `md`, becomes a top nav
(Phase 11).

### `TopAppBar`
`variant: 'greeting' | 'title'`
Greeting = avatar + "Good Morning 👋" + wordmark + bell (Home).
Title = avatar + title + bell (Explore, Saved).
Sticky; gains blur + shadow past 10px scroll.
> Avatar and bell have no data source without accounts — see `API_REQUIREMENTS.md` §6.

### `SearchField`
`variant: 'solid' | 'glass'` · `placeholder` · `value` · `onChange` · `onFocus`
Solid = `surface-container-high` (Home, Search). Glass = `bg-white/95 backdrop-blur` (Map).
Focus adds `ring-2 ring-primary/20` to the parent pill.

### `FilterButton`
Circular `tune` icon, 48dp, attached right of `SearchField`.

### `FilterChip`
`active` · pill. Active = navy fill / white text; inactive = bordered white.
Map overlay, Search.

### `CategoryChip`
Square cream tile + icon + label. **Home's square tile is canonical** — Explore's circular
variant was resolved against it in the audit. Home mood grid, Search popular categories.

### `SectionHeader`
`title` · `size: 'md' | 'lg'` · `actionLabel?` · `actionHref?`
Navy title + teal action link (`text-sm font-semibold`). Omitting the action renders
title only (Explore Quick Browse). Present on all four canonical screens.

`size='md'` = `text-lg font-bold` (root screens) · `size='lg'` = `text-xl font-bold`
(detail screens). Both weights are 700 — see `DESIGN_TOKENS.md` §2.

### `ChecklistRow`
`text`. `w-5 h-5 rounded-full bg-brand-teal/10` tile + 16px teal `check` glyph +
`text-sm font-medium text-on-surface-variant`. Venue Details "Why visit?", `gap-3`.

### `CardCarousel`
Horizontal scroll wrapper — `overflow-x-auto`, hidden scrollbar, `snap-x`. Keyboard
scrollable. Above `md`, degrades to a grid (Phase 11).

### `TabBar`
Segmented. Active = bold navy + underline; inactive = grey. Saved only. Full ARIA tab
semantics.

### `ListRowItem`
`icon` · `label` · `trailingValue?` · `href?` · chevron. `surface-container-low`,
48dp min height. Profile only.

### `EmptyState`
Cream icon tile + navy headline + grey subtext + optional `CTAButton`.
Search (no results), Saved (empty tab).

### `InfoPill`
`icon` · `label`
`bg-surface-container px-3 py-2.5 rounded-xl border border-outline-variant/10`; icon is
`text-brand-teal text-[20px]`, label `text-sm font-medium text-on-surface-variant`.
Venue Details info row, horizontally scrolling, `gap-3`.

Four instances in the export, each a distinct data need:
`schedule` "Until 7:00 PM" · `payments` "$$$" · `distance` "2 min From you" ·
`family_restroom` "Family Friendly".

### `StatTile`
`value` · `label` · `accent` · `highlighted`
Number over uppercase 10px label, `rounded-2xl`, `surface-container-low`. Map bottom
sheet, 4 across. **Each tile carries its own accent colour** (Places navy, Dining teal,
Beaches light blue, Events gold) and one tile may render **highlighted** — cream fill
with a gold border. Not a uniform tile, as the handoff implied.

### `StatusBadge`
`isOpen`. OPEN = `bg-secondary/10` + `text-secondary`; CLOSED = neutral. `rounded-lg`,
`text-xs font-bold`. Appears on every `VenueCard`. Derived from `opening_hours`.

---

## Layer 3 — Composite

### `VenueCard`
`variant: 'vertical-lg' | 'vertical-compact' | 'horizontal-row'` · `venue` · `showSaveButton?`

| Variant | Used by |
|---|---|
| `vertical-lg` | Home Trending (`min-w-[280px] w-[80%]`), Saved list |
| `vertical-compact` | Map bottom sheet |
| `horizontal-row` | Venue Details Nearby, Search results |

Verified anatomy of `horizontal-row` (from the Boca Beach export):

```
bg-surface-container-low · p-3 · rounded-2xl · border-outline-variant/10 · shadow-sm
  thumb   w-20 h-20 rounded-xl
  body    title (font-bold text-brand-navy)
          teal 16px location_on + "250m away" (text-xs)
          gold 16px star FILL 1 + "4.6" (text-xs bold) + "(180)" (text-[10px])
  chevron w-10 h-10 rounded-full bg-white shadow-sm  → 48dp in production
```

Verified anatomy of `vertical-lg` (from `sahelspot_home/code.html`):

```
rounded-3xl · bg-surface-container-lowest · shadow-md · border-outline-variant/10
  image h-48
    heart IconFAB  absolute top-3 right-3 · bg-white/80 backdrop-blur-md
                   active = text-tertiary FILL 1 · inactive = on-surface-variant/40
  body p-4 space-y-2
    row:  title (text-lg font-bold)          ┊  OPEN badge (bg-secondary/10,
          location (pin icon + text-sm)      ┊   text-secondary, text-xs, rounded-lg)
    row:  ★ gold FILL 1 · 4.8 (bold) · (120 reviews)
```

Two elements the handoff omitted and every card needs:
- **`StatusBadge`** — OPEN / CLOSED, teal-tinted. Derived from `opening_hours`.
- **Location row** — `location_on` icon + "Marassi, North Coast".

`vertical-compact` additionally renders **distance** inline: "Beach Club • 1.2 km".

One component, three variants — never three components. Composes `RatingBadge`,
`StatusBadge`, `Pill`, and (conditionally) `IconFAB`. Takes a domain `Venue`, not a raw
API response. Rating, distance, and open-status are all gaps; the component must render
correctly when each is absent.

### `DestinationCard`
`h-64 rounded-3xl`, image with `group-hover:scale-110` over 700ms, scrim
`bg-gradient-to-t from-primary/90 via-primary/20 to-transparent`, bottom-left text.
Title is `text-xl font-black text-white`; beneath it a **place count** in
`text-cream text-sm` ("124 Places") — an element the handoff omitted and which has no
API field today. Home Explore Destinations.

### `CollectionCard`
Image + gradient scrim + label only, `h-40`. Explore bento grid. Kept separate from
`DestinationCard` — different height, no subtitle, different domain object.

### `FeatureCard`
Large editorial card, `aspect-[4/5]` mobile: eyebrow + headline + body + `CTAButton`.
Explore Editor's Picks, Weekend Planner banner.

### `ImageGallery`
Hero carousel + counter + thumbnail strip. Venue Details only.

- Hero: `h-80` full-bleed, with `hero-gradient` overlay
  (`to bottom, rgba(0,0,0,.3) 0%, transparent 20%, transparent 80%, rgba(0,0,0,.4) 100%`)
- Counter: `absolute bottom-4 right-4 px-3 py-1 rounded-full bg-black/40 backdrop-blur-sm
  text-white text-xs font-medium` — "1/15"
- Thumbnails: `w-32 h-32 rounded-2xl shadow-sm`, horizontally scrolling, `gap-3`

Real `alt` per image; keyboard navigable; lightbox deferred past v1.

### `BottomSheet`
Drag handle + title/close row + content slot. Stitch's handle is visual only — production
adds real drag physics. Focus trap and Escape to close. Above `md`, becomes a side panel.

---

## Layer 4 — Map feature module

Isolated under `components/map/` and `lib/map/`; no other feature imports from it, and it
owns its Mapbox dependency so the rest of the app never loads it.

| Component | Notes |
|---|---|
| `MapView` | Mapbox GL JS container, dynamically imported, SSR-disabled |
| `MapMarker` | Circular, white 2px border, 5 category colours |
| `MapControls` | 2× `IconFAB` — locate, layers |
| `UserLocationDot` | Pulsing dot, 2s ease loop, `prefers-reduced-motion` aware |

---

## Removed

Every current component in `consumer/components/` is deleted in Phase 0. None survives
contact with the Stitch design — they are generic grey desktop-web scaffolding.

`Header`, `Footer`, `HeroSection`, `FeaturedDestinations`, `FeaturedVenues`, `VenueCard`,
`Section`, `Container`, `Button`

`lib/api.ts` and `lib/types.ts` are **kept and extended**, not deleted — the fetch layer,
`ApiError`, and the 404→`null` contract are all correct and stay.

---

## Build order

1. `CTAButton`, `IconFAB`, `Pill`, `Skeleton` — everything else depends on these
2. `BottomNav`, `TopAppBar` — unblocks the layout shells and makes every route reachable
3. `SearchField`, `FilterButton`, `FilterChip`, `CategoryChip`, `SectionHeader`, `CardCarousel`
4. `VenueCard` (all three variants), `DestinationCard`, `CollectionCard`, `FeatureCard`
5. `RatingStars`, `RatingBadge`, `InfoPill`, `StatTile`, `ImageGallery`
6. `TabBar`, `ListRowItem`, `EmptyState`, `PageDots`, `LogoLockup`
7. Map module — last, and only after the Map screen is validated against Stitch

Every component ships with its `aria-label`s, real `alt` handling, and 48dp targets from
the first commit. The audit's accessibility gaps are fixed at the component level so every
screen inherits the fix.
