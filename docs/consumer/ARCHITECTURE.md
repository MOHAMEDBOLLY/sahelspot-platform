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
      client.ts                   fetch, ApiError, base URL
      venues.ts  destinations.ts  search.ts
    domain/
      venue.ts  destination.ts    domain models + mappers
    hooks/                        TanStack Query hooks
    saved/                        SavedVenuesService interface + localStorage impl
    map/                          Mapbox config, marker colours, bounds
    utils/
  styles/globals.css              @theme tokens
```

Route groups `(root)` and `(push)` are what enforce approved decision 6: the bottom nav
is rendered by `(root)/layout.tsx` and cannot appear on a push screen, because no screen
renders it itself.

---

## 3. Domain models

The API shape and the UI shape are deliberately different types. `PublishedVenue` mirrors
the API exactly; `Venue` is what components consume.

```ts
// lib/api/types.ts — mirrors PublishedVenueOut exactly. Never used in components.
interface PublishedVenue { /* … as today … */ }

// lib/domain/venue.ts — what the UI consumes.
interface Venue {
  id: string;
  name: string;
  slug: string;
  destination: { id: string; name: string };
  district: string | null;
  category: VenueCategory;
  isFeatured: boolean;
  isVerified: boolean;
  coordinates: { lat: number; lng: number } | null;  // parsed from string
  contact: { phone; whatsapp; website; mapsUrl; instagram; facebook; tiktok };
  description: string | null;
  coverImageUrl: string | null;
  galleryImageUrls: string[];
  openingHours: OpeningHours | null;
  beachDetails: BeachDetails | null;
  rating: Rating | null;        // ← API gap; null until delivered
}
```

The mapper is the single place that:
- parses `latitude`/`longitude` from `string | null` into a real `{lat, lng}` or `null`
- normalises `gallery_image_urls: string[] | null` to `[]`
- narrows `category: string` to a `VenueCategory` union (needed for marker colours)
- gives structure to the untyped `opening_hours` / `beach_details` JSON blobs

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

Isolated behind `SavedVenuesService` (`lib/saved/`) so a future authenticated
implementation replaces it without touching the UI layer:

```ts
interface SavedVenuesService {
  list(): Promise<string[]>;
  has(venueId: string): Promise<boolean>;
  add(venueId: string): Promise<void>;
  remove(venueId: string): Promise<void>;
  subscribe(fn: (ids: string[]) => void): () => void;
}
```

`LocalStorageSavedVenuesService` is the only v1 implementation. The async signature is
deliberate — it costs nothing now and means a network-backed implementation later is a
substitution rather than a rewrite. Components use `useSavedVenues()`; **no component
touches `localStorage` directly.** Only venue *ids* are stored; venue content is always
re-fetched from `/public/venues`, so the Studio API remains the single source of truth.

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
