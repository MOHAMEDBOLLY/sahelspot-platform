# Consumer — Application Architecture

Next.js 16 App Router · React 19 · TypeScript (strict) · Tailwind v4 · TanStack Query ·
Mapbox GL JS · Framer Motion (Phase 10) · Lucide + Material Symbols.

**Single backend: the SahelSpot Studio Public API.** No Supabase, no direct database
access, no parallel data source, now or later.

---

## 1. Data flow

```
Studio (editorial)  →  publish revision snapshot  →  /public/*  →  Consumer
```

`/public/*` reads only the current publish revision's frozen snapshot, never the draft
tables — a structural guarantee in `api/app/api/routes/public.py`, which imports no ORM
models at all. The Consumer Website is therefore always reading published content by
construction.

The Consumer Website is **read-only and unauthenticated**. It never calls `/editor/*`.

### Current public surface

| Endpoint | Returns |
|---|---|
| `GET /public/venues` | `PublishedVenue[]` |
| `GET /public/venues/{id}` | `PublishedVenue` · 404 |
| `GET /public/destinations` | `PublishedDestination[]` |
| `GET /public/search/venues?q&category` | `PublishedVenue[]` |

Fields the UI needs beyond this are recorded in `API_REQUIREMENTS.md` and delivered
through the Studio publishing pipeline — never mocked permanently, never sourced elsewhere.

---

## 2. Folder structure

```
consumer/
  app/
    layout.tsx                    root: fonts, <html lang>, providers
    (root)/                       root-tab shell — TopAppBar + scroll + BottomNav
      layout.tsx
      page.tsx                    Home
      explore/page.tsx
      map/page.tsx
      saved/page.tsx
      more/page.tsx
    (push)/                       push shell — no BottomNav
      layout.tsx
      venues/[id]/page.tsx
      venues/[id]/not-found.tsx
      search/page.tsx
    onboarding/page.tsx           standalone
  components/
    ui/                           Layer 1 primitives
    nav/                          Layer 2 navigation
    patterns/                     Layer 2 remaining
    venue/  destination/  editorial/   Layer 3
    map/                          Layer 4 — isolated
  lib/
    api/
      client.ts                   apiGetList / apiGetOrNull, ApiError, base URL
      dto.ts                      PublishedVenueDTO / PublishedDestinationDTO
      venues.ts  destinations.ts  fetchVenues, fetchVenue, searchVenues, fetchDestinations
    domain/
      venue.ts  destination.ts    Venue / Destination — the UI-facing shapes
      mappers/
        venue.ts  destination.ts  DTO -> Domain, one function per resource
    hooks/
      useVenues.ts  useVenue.ts  useDestinations.ts  useSearchVenues.ts
    saved/
      types.ts                   SavedRepository interface
      localStorageSavedRepository.ts
      repository.ts               the one wiring point — swap the impl here only
      useSaved.ts                 the hook every component actually uses
    map/                          Mapbox config, marker colours, bounds
    utils/
  styles/globals.css              @theme tokens
```

Route groups `(root)` and `(push)` are what enforce approved decision 6: the bottom nav
is rendered by `(root)/layout.tsx` and cannot appear on a push screen, because no screen
renders it itself.

---

## 3. Data flow

```
SahelSpot Studio → Public API → API Client → DTO → Mapper → Domain Model
                                                              → View Model → UI
```

Each arrow is a real seam in the code, not a conceptual one:

| Stage | Lives in | Example |
|---|---|---|
| API Client | `lib/api/client.ts` | `apiGetList`, `apiGetOrNull` — the only functions that call `fetch` |
| DTO | `lib/api/dto.ts` | `PublishedVenueDTO` — mirrors `PublishedVenueOut` exactly, snake_case included |
| Mapper | `lib/domain/mappers/venue.ts` | `toVenue(dto): Venue` — the only place a DTO field becomes a domain field |
| Domain Model | `lib/domain/venue.ts` | `Venue` — camelCase, parsed coordinates, closed category union |
| View Model | per-screen, from Phase 4 on | e.g. Home composes `Venue[]` + curation into what its sections actually render |
| UI Components | `components/**` | Consume `Venue`/`Destination` (or a screen's view model), never a DTO |

For Phase 3, hooks (`lib/hooks/`) return the Domain Model directly — for a plain list
screen the domain model *is* the view model, so no extra layer is invented where nothing
needs shaping yet. A screen-specific view model appears the moment a screen actually
composes multiple things (Home's curated rows, Map's bottom-sheet stats); it is built
alongside that screen in its own phase, not speculatively here.

`PublishedVenueDTO` and `Venue` are deliberately different types:

```ts
// lib/api/dto.ts — mirrors PublishedVenueOut exactly. Never imported by a component.
interface PublishedVenueDTO { /* … snake_case, as the wire sends it … */ }

// lib/domain/venue.ts — what hooks return and components consume.
interface Venue {
  id: string;
  slug: string;
  name: string;
  destinationName: string;
  district: string | null;
  category: VenueCategory;
  isFeatured: boolean;
  isVerified: boolean;
  coordinates: { lat: number; lng: number } | null;  // parsed from string, or null if unparseable
  coverImageUrl: string | null;
  galleryImageUrls: string[];                        // null -> []
  shortDescription: string | null;
  contact: { phone; whatsapp; website; mapsUrl };
  rating: number | null;          // API_REQUIREMENTS.md §1 — no source yet
  reviewCount: number | null;
  isOpenNow: boolean | null;      // §7 — opening_hours shape not agreed with Studio yet
  distanceLabel: string | null;   // §4
  priceRange: string | null;      // §8
  tags: string[];
  amenities: string[];
  highlights: string[];
}
```

`lib/domain/mappers/venue.ts`'s `toVenue` is the single place that:
- parses `latitude`/`longitude` from `string | null` into `{lat, lng} | null`, treating an
  unparseable value the same as absent rather than plotting it at `0,0`
- normalises `gallery_image_urls: string[] | null` to `[]`
- narrows `category: string` to the closed `VenueCategory` union, falling an unrecognized
  value back to `"general"` rather than throwing — a marker in the wrong colour is a much
  smaller failure than a venue vanishing from the whole app
- sets every field with an open `API_REQUIREMENTS.md` gap to `null` / `[]`

Components never see snake_case, never see a stringified coordinate, and never
null-check a list. When a gap in `API_REQUIREMENTS.md` is filled, only the mapper changes.

---

## 4. State

| Kind | Mechanism |
|---|---|
| Server state | TanStack Query — one hook per resource |
| Navigation state | URL (search query, active filter, selected pin) |
| Ephemeral UI | local `useState` |
| Device-local | `localStorage` — recent searches, onboarding-seen flag |

No Redux, no Zustand, no global store. Nothing in this app justifies one.

Recent searches, the onboarding-seen flag, and **saved venues** are **device preferences,
not user data** — they need no backend and do not contradict the no-accounts decision.

### Saved venues

Isolated behind `SavedRepository` (`lib/saved/`) so a future authenticated
implementation replaces it without touching the UI layer:

```ts
interface SavedRepository {
  list(): Promise<string[]>;
  has(venueId: string): Promise<boolean>;
  add(venueId: string): Promise<void>;
  remove(venueId: string): Promise<void>;
  subscribe(fn: (ids: string[]) => void): () => void;
}
```

`LocalStorageSavedRepository` is the only v1 implementation, wired in one place —
`lib/saved/repository.ts` exports the single `savedRepository` instance, and nothing
outside that file imports the localStorage class directly. The async signature on every
method is deliberate: it costs nothing now and means a network-backed implementation
later is a substitution at that one wiring point, not a rewrite of the interface or its
callers.

Components use `useSaved()` (`lib/saved/useSaved.ts`); **no component touches
`localStorage` or the repository directly.** Only venue *ids* are stored; venue content
is always re-fetched from `/public/venues` through the same Domain Model pipeline as
everywhere else, so Studio remains the single content source — the repository is a list
of references into it, not a second one.

Query defaults: `staleTime: 5min`, `gcTime: 30min`, no refetch on window focus. Published
content changes only on publish, so aggressive caching is correct.

Server Components fetch and prefetch; Client Components (`'use client'`) are used only
where interaction demands it — map, search input, carousels, sheet, tabs, onboarding.

---

## 5. Map module isolation

`components/map/` and `lib/map/` are the only places Mapbox is imported. `MapView` is
dynamically imported with `ssr: false` so the ~200KB GL bundle never enters any other
route's payload. Token via `NEXT_PUBLIC_MAPBOX_TOKEN`.

Venues with `coordinates === null` are excluded from the map, not rendered at 0,0.

---

## 6. Rendering and SEO

Every route is public, cacheable content — this is the reason the Next.js App Router was
kept over a Vite SPA.

- Venue detail: `generateStaticParams` from `/public/venues`, ISR revalidation
- `generateMetadata` per venue — title, description, OG image from `cover_image_url`
- `sitemap.ts` and `robots.ts` generated from the published snapshot
- JSON-LD `LocalBusiness` / `TouristAttraction` per venue
- `next/image` for all imagery, with the media host in `remotePatterns`

The URL scheme and 404 semantics of `docs/adr/0001-public-venue-urls.md` are unchanged.

---

## 7. Error, loading, empty

Three states for every data-backed screen, no exceptions:

- **Loading** — `Skeleton` matched to the real component's dimensions, via `loading.tsx`
- **Error** — `error.tsx` boundary with a retry action; `ApiError` already distinguishes
  unreachable / bad-status / unparseable
- **Empty** — `EmptyState`; note that `/public/*` legitimately returns `[]` when no publish
  revision exists yet, which is an empty state, not an error

---

## 8. Accessibility

Enforced at the component layer so screens inherit it: real `alt` (never `data-alt`),
`aria-label` on every icon-only control, 48dp minimum targets, visible focus rings,
`aria-hidden` on decorative icon rows, full keyboard paths through carousels, tabs, and
the bottom sheet. A colour-contrast pass on `on-surface-variant/60` and 10px labels is a
release gate.

---

## 9. Configuration

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Public API base (exists) |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox GL JS |

---

## 10. Constraints

1. Only `/public/*`. Never `/editor/*`, never a second backend.
2. No user accounts, no user-specific features, and no architecture that presumes them.
3. Missing fields become API requirements, never permanent mocks.
4. Bottom nav on root screens only.
5. Literal hex tokens — never a Stitch colour alias.
6. No dark mode. Stitch defines one light theme.
7. Mobile is implemented first and exactly; desktop adapts the same language afterwards.
