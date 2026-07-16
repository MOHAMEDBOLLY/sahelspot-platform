# SahelSpot Studio

The editorial/admin frontend for SahelSpot Platform — where content is edited, reviewed, and published. See [`../docs/PRODUCT.md`](../docs/PRODUCT.md#content--publishing-model) and [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md#publishing-architecture) for the draft → publish model this app is built around.

## Status

**Shell + Venue Workspace** (Sprint 7), reading an enriched API contract (Sprint 8), with **Edit Mode** (Sprint 9): the workspace toggles between View and Edit, and most fields become inputs — but nothing is saved. No API mutations, no PATCH, no validation, no dirty tracking, no autosave, no authentication yet. State only ever exists in React; Cancel discards it completely.

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
│       ├── venueCategories.ts    # fixed category list, mirrors the API's CHECK constraint
│       ├── VenueList.tsx         # presentational: clickable venue rows
│       ├── VenueListPanel.tsx    # stateful: loading/error/empty + VenueList
│       └── workspace/
│           ├── VenueWorkspace.tsx     # stateful: no-selection/loading/error + mode + draft + sections
│           ├── WorkspaceToolbar.tsx   # Edit / Cancel button
│           ├── WorkspaceSection.tsx   # shared section card chrome (title + icon)
│           ├── WorkspaceField.tsx     # view-mode "label / value" row, with placeholder
│           ├── types.ts               # WorkspaceMode = 'view' | 'edit'
│           ├── fields/                # edit-mode input atoms — each does exactly one control type
│           │   ├── TextField.tsx        # text / url / tel
│           │   ├── TextAreaField.tsx
│           │   ├── SelectField.tsx
│           │   └── CheckboxField.tsx
│           └── sections/
│               ├── BasicInfoSection.tsx     # editable: Name, Category, District, Featured, Verified, Short Description
│               ├── LocationSection.tsx      # editable: Latitude, Longitude, Maps Link
│               ├── ContactSection.tsx       # editable: Phone, WhatsApp, Website, Instagram, Facebook, TikTok
│               ├── OpeningHoursSection.tsx  # view-only in both modes (needs a dedicated time-range editor)
│               ├── ImagesSection.tsx        # view-only in both modes (needs a dedicated upload UI)
│               └── PublishingStatusSection.tsx  # editable: Internal Notes only; Status/dates/Source stay read-only
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

- All business logic (validation, status meaning, filtering, id → name resolution) lives in the API — the frontend only fetches and displays what the API returns. As of Sprint 8, `GET /venues`/`GET /venues/{id}` return a resolved `destination: {id, name}` object (see [`../docs/API.md`](../docs/API.md#response-model-enrichment-sprint-8)) — the frontend reads `venue.destination.name` directly, no client-side lookup.
- TanStack Query's `networkMode: 'always'` is set globally in `main.tsx` — the default `'online'` mode can leave a query stuck in a "paused" state (indistinguishable from loading) when the browser's connectivity/visibility signals are unreliable, which is worth knowing if a query ever seems to hang without erring.
- `useVenue(id)` seeds its `initialData` from the already-fetched `['venues']` list cache, since `GET /venues` returns full venue objects (same shape as `GET /venues/{id}`). Selecting a venue already visible in the list renders instantly with no extra network round trip.
- **Edit Mode (Sprint 9)**: `VenueWorkspace` holds `mode: 'view' | 'edit'` and a `draft` copy of the venue, created only when Edit is clicked. View mode always renders the real fetched `venue`; edit mode renders `draft`. Cancel drops the draft and returns to view — nothing is ever sent to the API. Not every field is editable: `Destination` (needs a real picker, i.e. an API call — deferred), `Slug` (structural/URL identity, needs its own validation later), and `Status`/timestamps/`Source` in Publishing Status (system- or workflow-managed, not generic text) stay read-only in both modes. Opening Hours and Images are view-only in both modes — they need dedicated editors (a time-range picker, an upload UI), not a text input.
