# SahelSpot — Consumer Site

The public-facing website — destinations, venues, search. Reads only the
existing `/public/*` API (`../api/`): no authentication, no editorial
functionality. See [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md)
and the Release 1 milestone plan for the product/architecture reasoning.

## Status

**Repository bootstrap only** (M1) — an empty Next.js app with a
placeholder page. No API calls, no design system, no real pages yet.

## Stack

Next.js (App Router), TypeScript, Tailwind CSS v4.

## Setup

```bash
cd consumer
npm install
cp .env.example .env.local   # optional — only needed if the API isn't on localhost:8000
npm run dev
```

The API (`../api/`) must be running separately for later milestones — see
[`../api/README.md`](../api/README.md). M1 itself makes no API calls.

- Dev server: http://localhost:3000
- `npm run build` — type-checks and produces a production build
- `npm run start` — serves the production build
