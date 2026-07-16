# SahelSpot Studio

The editorial/admin frontend for SahelSpot Platform — where content is edited, reviewed, and published. See [`../docs/PRODUCT.md`](../docs/PRODUCT.md#content--publishing-model) and [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md#publishing-architecture) for the draft → publish model this app is built around.

## Status

**Shell only** (Sprint 5). Application shell, sidebar, header, routing, and page structure exist. No business features, no API connection, no forms, no authentication yet.

## Stack

React, Vite, TypeScript, Tailwind CSS v4, React Router, TanStack Query, Lucide Icons — per [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).

## Setup

```bash
cd datalab-next
npm install
npm run dev
```

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
├── components/
│   ├── Sidebar.tsx
│   ├── Header.tsx
│   └── PagePlaceholder.tsx # shared "not built yet" state for unbuilt sections
└── pages/
    ├── Dashboard.tsx        # welcome page
    ├── Venues.tsx
    ├── Destinations.tsx
    ├── Publishing.tsx
    └── Settings.tsx
```
