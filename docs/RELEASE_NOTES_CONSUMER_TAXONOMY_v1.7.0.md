# Release Notes — Consumer Taxonomy Experience (v1.7.0)

**Component:** Consumer (`consumer/`) only — no API, Studio, database, or
publishing changes in this release.

---

## Executive Summary

This release closes out Consumer Phase 2: the Category/Tags/Access
Type/Badges/Collections taxonomy the backend has served since commit
`e71880c` is now a real, visible part of the Consumer experience, not
just data sitting unused in API responses.

Phase 1 (an earlier release on this same `main` branch) fixed the root
cause a production investigation had found: the Consumer's DTO/mapper
layer never declared `tags`/`access_type`/`reservation_policy`, so the
fields were silently dropped. That release wired the data layer end to
end and surfaced Access Type/Reservation Policy/tags on Venue Details.

This release (Phase 2) builds the *experience* on top of that data
layer: Home, Explore, and Search now all have real, taxonomy-driven
discovery surfaces, and Venue Details gains a tag-based "Similar
Experiences" section. A final production-readiness review (mobile/
tablet layout, dark mode/RTL applicability, empty states, performance,
bundle size, accessibility, re-render behavior) found and fixed one
real defect — see below — and one pre-existing, unrelated lint failure
was also fixed as part of the release-gate cleanup.

---

## Major Features

- **Home** — a "Popular Tags" chip row (real tag slugs, most-popular
  first, never hardcoded) directly below the existing activity grid;
  dynamic "X Spots" venue rails that auto-activate once a tag has
  enough tagged venues to be worth its own section.
- **Explore** — rebuilt from a static "Phase 8" placeholder into a real
  taxonomy browse screen: Browse by Category, Browse by Tag, Browse by
  Access Type, each linking into Search with the matching filter
  already active; a Collections section that explains — in place, not
  as a dead end — the one remaining backend gap (see Known
  Limitations).
- **Search** — new Tags (multi-select, OR semantics matching the
  backend exactly) and Reservation Policy (client-side, since the
  public API has no server-side filter for it) rows, alongside the
  existing Category and Access Type filters. All filter state restores
  from the URL, so Home/Explore's deep links land pre-filtered.
- **Venue Details** — new "Similar Experiences" section: other venues
  sharing at least one tag with the current venue, ranked by shared-tag
  count, additive to (never duplicating) the existing "Nearby Places."

## Fixes Included in This Release

- **Performance:** `SearchClient` was fetching the full venue catalog
  unconditionally on every Search page load — including the default
  "recent searches" screen, before the data it fed (the Tags row) ever
  rendered. Fixed by gating the fetch on the same condition that gates
  the row itself. Verified live: zero API requests on Search's default
  state now.
- **Lint:** a pre-existing, unrelated `no-unused-vars` failure in
  `components/patterns/SearchField.tsx` (present on `main` before this
  release) was blocking the CI lint gate. Fixed with the linter's own
  suggested one-line remediation — no behavior change.
- **Dead code:** `components/ui/PhasePlaceholder.tsx` removed — it had
  exactly one caller (the old Explore placeholder), which this release
  replaces.

## Known Limitations

- **Collections** are still not browsable from the Consumer UI.
  `GET /public/collections/{slug}` works; there is still no
  `GET /public/collections` (list) endpoint to discover which slugs
  exist (`docs/consumer/API_REQUIREMENTS.md` §2). The domain model
  (`Collection`/`toCollection`) is ready; Explore's Collections section
  states this gap in place rather than blocking the rest of the screen.
- **Tag rails on Home** are data-driven and currently below their
  visibility threshold for most tags (today's max is ~4 venues per
  tag). This is expected, correct behavior, not a bug — rails activate
  automatically as Studio tags more venues, no further Consumer changes
  required.
- **No dark mode, no RTL** — both are pre-existing, documented product
  decisions for the whole app (`docs/consumer/ARCHITECTURE.md`), not
  gaps introduced or left by this release.

---

## Verification Performed

- `npx tsc --noEmit` — 0 errors.
- `npm run lint` — 0 errors (previously 1, fixed — see above).
- `npm run build` — succeeded, all 15 routes.
- Live browser verification against the production API
  (`api.sahelspot.com`) at mobile (375×812) and tablet (768×1024)
  viewports: Home's Popular Tags row, Explore's full taxonomy browse
  with working deep links into Search, Search's four-filter-row
  combination producing correct results, Venue Details' Similar
  Experiences — all confirmed rendering real data, not assumed from
  code review alone.
- Accessibility tree inspected directly (not just visually) — every new
  interactive element exposes a correct accessible name.

---

## Deployment

Consumer-only. No API/Studio/database/publishing changes; no
migrations. See the deployment report for this release for the exact
commit SHA, containers restarted, and rollback procedure.
