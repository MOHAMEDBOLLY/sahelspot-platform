# Consumer — Public API Requirements

Fields and endpoints the Stitch design requires that the Public API does not yet expose.

Per approved decision 5: **missing data is never permanently mocked.** Each gap below is
an API requirement to be delivered through the Studio publishing pipeline. The Consumer
Website depends on the Public API and maintains no parallel data model.

Every item requires work in three places — Studio editorial model → publish snapshot →
`PublishedVenueOut` / a new public route — because `/public/*` reads only the frozen
snapshot (`api/app/api/routes/public.py`).

**Priority key:** P0 blocks a screen · P1 degrades a screen · P2 cosmetic.

---

## 1. Ratings and reviews — P0

**Needed by:** every `VenueCard` variant, `RatingBadge`, Venue Details header
(`RatingStars` + numeric + review count), Search results.
**Screens:** Home, Explore, Map, Search, Venue Details, Saved — six of nine.

```
PublishedVenueOut:
  rating: float | None          # e.g. 4.8
  review_count: int | None      # e.g. 230
```

The design shows ratings on essentially every card in the product. This is the single
highest-impact gap.

**Open question for Studio:** are ratings editorially curated, or aggregated from a review
system that does not exist yet? If the latter, this is a much larger piece of work than a
field addition, and the interim answer may be to omit rating UI rather than fake it.
Components are specified to render correctly when `rating` is `null`.

---

## 2. Editorial collections — P0

**Needed by:** Explore — Collections bento grid, Editor's Picks, Weekend Planner.
**Screens:** Explore (approximately the entire screen).

No content model for any of this exists in Studio today. Explore cannot be built until it
does.

```
GET /public/collections            -> PublishedCollection[]
GET /public/collections/{slug}     -> PublishedCollection

PublishedCollection:
  id, slug, title
  subtitle: str | None
  eyebrow: str | None              # "Plan Your Day"
  body: str | None
  cover_image_url: str | None
  kind: "collection" | "editors_pick" | "planner"
  venue_ids: list[str]
  sort_order: int
```

`kind` lets one model serve all three Explore regions rather than three near-identical
models. This is a new editorial entity in Studio with its own workflow and publish path.

---

## 3a. Destination imagery — P0 (found while implementing Home)

**Needed by:** `DestinationCard` on Home's Explore Destinations grid.

`PublishedDestinationDTO` has no image field at all — `id`, `name`, `region`, `aliases`,
`boundary` only. `DestinationCard` degrades to a solid `primary-container` fill when
`imageUrl` is `null`, which is what Home renders today; every destination card in the
export has a photograph.

```
PublishedDestinationOut:
  cover_image_url: str | None
```

**Raised to P0 on review**: destination imagery is core to the visual experience, not a
cosmetic gap — this should land in the Public API before launch, not be treated as a
degrade-gracefully case long-term.

---

## 3. Home curation — P1

**Needed by:** Home — Trending Today, Hidden Gems.

`is_featured` already exists and can drive one row. Two distinct curated rows cannot both
come from a single boolean.

Preferred: reuse the §2 collection model with `kind: "trending" | "hidden_gem"`, so Home
and Explore share one mechanism.
Minimal alternative: `home_section: str | None` on the venue.

**Implemented in Phase 4:** Trending Today uses the one real signal available —
`is_featured` — rather than waiting on this requirement; still a real field, not a mock.
Hidden Gems has no fallback of any kind (no second boolean to reuse) and is omitted from
Home entirely until this requirement is delivered.

---

## 4. Geospatial — P1

**Needed by:** Map (viewport queries), Search and Venue Details Nearby (distance labels).

```
GET /public/venues/nearby?lat&lng&radius_km&limit   -> PublishedVenue[] (+ distance_km)
```

Also: `latitude` and `longitude` are currently `str | None`. Numeric types would be
correct, but the Consumer mapper parses them either way — this is not blocking.

Distance labels ("250m", "1.2km") need either this endpoint or client-side computation
from browser geolocation. Client-side is acceptable and needs no API work, but requires a
location permission prompt; the design shows distances without any visible permission
flow. **Decision needed.**

Venue Details "Nearby Places" can be served in the interim by filtering
`/public/venues` to the same destination — correct, cheap, no API change.

---

## 5. Weather — P2

**Needed by:** Home hero weather pill ("31°C Sunny").

This is live third-party data, not published editorial content, and does not belong in the
publish snapshot. Two honest options: a thin Studio proxy endpoint
(`GET /public/weather?destination_id=`), or drop the pill from v1.

Recommendation: **drop it from v1.** It is one decorative pill, it is the only element in
the product that would introduce a second data source, and decision 3 forbids exactly that.

---

## 6. Account-dependent UI — resolved, no API needed

| Element | Resolution |
|---|---|
| Save / heart control | ✅ Device-local `localStorage` behind `SavedRepository` |
| Saved tab content | ✅ Same service; ids only, content re-fetched from `/public/venues` |
| Account group on More | ✅ Removed — More is application-level items only |
| Avatar + "Good Morning 👋" greeting | ⚠️ No user to greet. Recommend a static wordmark header |
| Notification bell | ⚠️ No notifications exist. Recommend removal from v1 |

The first three need no backend at all. The last two are the only remaining
account-shaped elements; both are decorative and neither blocks a screen.

---

## 8. Venue Details fields — P1

Confirmed from the Boca Beach export. None exists on `PublishedVenueOut` today.

```
price_range: str | None        # "$$$"  — InfoPill
tags: list[str] | None         # ["Beach Club", "Beachfront"] — cream pills
                               #   `category` supplies one; the second has no source
amenities: list[str] | None    # ["Family Friendly"] — InfoPill
highlights: list[str] | None   # 4× "Why visit?" checklist rows
```

`highlights` may instead be derivable from `beach_details` — see §7. Confirm with Studio
rather than assuming.

Rating precision: the export renders `star_half`, so `rating` must be a float, not an
integer, for the star row to be correct.

---

## 7. Structured content — P1

Two blobs are typed `dict | None` on the wire and need a documented shape before the UI
can render them reliably:

- **`opening_hours`** — drives Venue Details `InfoPill`s and any "Open now" indicator.
- **`beach_details`** — the likeliest source for the "Why Visit" checklist (4 rows,
  circular teal check + text). If it is not, "Why Visit" needs its own field:
  `highlights: list[str] | None`.

The Consumer domain mapper defines `OpeningHours` and `BeachDetails` types; those
definitions must be agreed against what Studio actually publishes, not inferred.

---

## Summary

| # | Requirement | Priority | Blocks |
|---|---|---|---|
| 1 | `rating`, `review_count` | P0 | 6 screens (degraded) |
| 2 | Collections model + endpoints | P0 | Explore (entirely) |
| 3 | Home curation (Hidden Gems only — Trending uses `is_featured`) | P1 | Home Hidden Gems |
| 3a | Destination cover image | **P0** | Home Explore Destinations — before launch |
| 4 | Nearby endpoint / distance | P1 | Map, Search, Nearby |
| 5 | Weather | P2 | Home weather pill — recommend dropping |
| 6 | Account-dependent UI | — | ✅ Resolved without API work |
| 7 | `opening_hours` / `beach_details` shape | P1 | Venue Details |
| 8 | `price_range`, `tags`, `amenities`, `highlights` | P1 | Venue Details |

**Buildable to full fidelity today:** Saved, More, Splash, Onboarding, Search (minus
distance), Map (minus stats and viewport query), Venue Details (minus ratings, price,
amenities, highlights, Nearby distance), Home (minus ratings, weather, place counts).

**Not buildable today:** Explore only — §2 is the single remaining hard content blocker,
and it blocks one screen out of nine.

Every other gap degrades a screen rather than blocking it, because every component is
specified to render correctly when optional data is absent.
