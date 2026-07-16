# SahelSpot Studio

The editorial/admin frontend for SahelSpot Platform — where content is edited, reviewed, and published. See [`../docs/PRODUCT.md`](../docs/PRODUCT.md#content--publishing-model) and [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md#publishing-architecture) for the draft → publish model this app is built around.

## Status

**Shell + Venue Workspace, read-only** (Sprint 7). Selecting a venue from the list opens a two-panel workspace showing its full detail across six sections. No editing, creating, deleting, publishing, forms, or authentication yet — that's the next layer, built on this same architecture (see [Deliverables](#deliverables) below).

## Stack

React, Vite, TypeScript, Tailwind CSS v4, React Router, TanStack Query, Lucide Icons — per [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).

## Setup

```bash
cd datalab-next
npm install
cp .env.example .env.local   # optional — only needed if the API isn't on localhost:8000
npm run dev
```

The API (`../api/`) must be running separately — see [`../api/README.md`](../api/README.md) — with `GET /venues` and `GET /venues/{id}` reachable and CORS allowing `http://localhost:5173` (already configured in `api/app/main.py`).

- Dev server: http://localhost:5173
- `npm run build` — type-check (`tsc -b`) and production build
- `npm run lint` — oxlint

## Structure

```
src/
├── main.tsx              # entry point: QueryClientProvider + BrowserRouter + App
├── App.tsx                # route definitions
├── config/
│   └── navigation.ts       # single source of truth for sidebar items (path, label, icon)
├── layouts/
│   └── AppShell.tsx        # Sidebar + Header + <Outlet /> content area
├── lib/
│   ├── apiClient.ts          # fetch wrapper (base URL, ApiError) — the only place that talks HTTP
│   └── formatDate.ts          # shared date formatting for display
├── types/
│   └── venue.ts              # full Venue type (matches GET /venues and GET /venues/{id})
├── features/
│   └── venues/
│       ├── api.ts                # fetchVenues(), fetchVenue(id)
│       ├── useVenues.ts          # TanStack Query hook — venue list
│       ├── useVenue.ts           # TanStack Query hook — single venue, seeded from the list cache
│       ├── VenueList.tsx         # presentational: clickable venue rows
│       ├── VenueListPanel.tsx    # stateful: loading/error/empty + VenueList
│       └── workspace/
│           ├── VenueWorkspace.tsx     # stateful: no-selection/loading/error + sections
│           ├── WorkspaceSection.tsx   # shared section card chrome (title + icon)
│           ├── WorkspaceField.tsx     # shared "label / value" row, with placeholder
│           └── sections/
│               ├── BasicInfoSection.tsx
│               ├── LocationSection.tsx
│               ├── ContactSection.tsx
│               ├── OpeningHoursSection.tsx
│               ├── ImagesSection.tsx
│               └── PublishingStatusSection.tsx
├── components/
│   ├── Sidebar.tsx
│   ├── Header.tsx
│   ├── PagePlaceholder.tsx    # shared empty / "nothing selected" state
│   ├── LoadingState.tsx
│   ├── ErrorState.tsx          # includes a retry action
│   └── StatusBadge.tsx         # colored badge for draft/review/approved/archived
└── pages/
    ├── Dashboard.tsx        # welcome page
    ├── Venues.tsx             # thin: owns selectedVenueId, composes VenueListPanel + VenueWorkspace
    ├── Destinations.tsx
    ├── Publishing.tsx
    └── Settings.tsx
```

`features/<name>/` holds anything specific to one feature (its API calls, its query hooks, its display components). `components/` holds generic, reusable-across-features UI. This is the pattern future features (Destinations, Publishing) should follow.

## Notes

- All business logic (validation, status meaning, filtering) lives in the API — the frontend only fetches and displays what the API returns.
- `GET /venues` currently returns `destination_id` (e.g. `"marassi"`), not a resolved destination name — displayed as-is. Resolving it to a display name is an API-side concern for a later sprint, not something joined client-side.
- TanStack Query's `networkMode: 'always'` is set globally in `main.tsx` — the default `'online'` mode can leave a query stuck in a "paused" state (indistinguishable from loading) when the browser's connectivity/visibility signals are unreliable, which is worth knowing if a query ever seems to hang without erring.
- `useVenue(id)` seeds its `initialData` from the already-fetched `['venues']` list cache, since `GET /venues` returns full venue objects (same shape as `GET /venues/{id}`). Selecting a venue already visible in the list renders instantly with no extra network round trip.
