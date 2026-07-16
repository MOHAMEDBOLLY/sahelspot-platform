# SahelSpot Studio

The editorial/admin frontend for SahelSpot Platform — where content is edited, reviewed, and published. See [`../docs/PRODUCT.md`](../docs/PRODUCT.md#content--publishing-model) and [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md#publishing-architecture) for the draft → publish model this app is built around.

## Status

**Shell + first read-only feature** (Sprint 6). Application shell, routing, and a live Venues list fetched from the API exist. No editing, creating, deleting, publishing, forms, or authentication yet.

## Stack

React, Vite, TypeScript, Tailwind CSS v4, React Router, TanStack Query, Lucide Icons — per [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).

## Setup

```bash
cd datalab-next
npm install
cp .env.example .env.local   # optional — only needed if the API isn't on localhost:8000
npm run dev
```

The API (`../api/`) must be running separately — see [`../api/README.md`](../api/README.md) — with `GET /venues` reachable and CORS allowing `http://localhost:5173` (already configured in `api/app/main.py`).

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
│   └── apiClient.ts         # fetch wrapper (base URL, ApiError) — the only place that talks HTTP
├── types/
│   └── venue.ts              # Venue TypeScript type
├── features/
│   └── venues/
│       ├── api.ts              # fetchVenues()
│       ├── useVenues.ts        # TanStack Query hook
│       └── VenueTable.tsx      # renders a list of venues
├── components/
│   ├── Sidebar.tsx
│   ├── Header.tsx
│   ├── PagePlaceholder.tsx    # shared "not built yet" / empty state
│   ├── LoadingState.tsx        # shared loading state
│   ├── ErrorState.tsx          # shared error state, with retry
│   └── StatusBadge.tsx         # colored badge for draft/review/approved/archived
└── pages/
    ├── Dashboard.tsx        # welcome page
    ├── Venues.tsx             # fetches + renders loading/error/empty/table states
    ├── Destinations.tsx
    ├── Publishing.tsx
    └── Settings.tsx
```

`features/<name>/` holds anything specific to one feature (its API call, its query hook, its table). `components/` holds generic, reusable-across-features UI. This is the pattern future features (Destinations, Publishing) should follow.

## Notes

- All business logic (validation, status meaning, filtering) lives in the API — the frontend only fetches and displays what the API returns.
- `GET /venues` currently returns `destination_id` (e.g. `"marassi"`), not a resolved destination name — the Destination column shows that value as-is. Resolving it to a display name is an API-side concern for a later sprint, not something this page joins client-side.
- TanStack Query's `networkMode: 'always'` is set globally in `main.tsx` — the default `'online'` mode can leave a query stuck in a "paused" state (indistinguishable from loading) when the browser's connectivity/visibility signals are unreliable, which is worth knowing if a query ever seems to hang without erring.
