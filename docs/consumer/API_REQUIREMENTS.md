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

## 3b. Events — P1 (found while implementing Map)

**Needed by:** Map bottom sheet's 4th `StatTile` ("Events"), Home mood grid's "Events"
chip (the chip itself is fine — it's a `/search?category=event` link with nothing behind
it yet).

The domain's `VenueCategory` union (`beach | food | coffee | nightlife | general`) has no
`event` member, and nothing in `PublishedVenueOut` suggests events are modelled as venues
at all — they're more likely a distinct content type (start/end time, a venue they occur
at) than a venue category. Until Studio defines one, the Map bottom sheet renders 3 stat
tiles (Places, Dining, Beaches), not 4 — omitted, not shown as `0` or `—`, since a real
event count of zero and "we have no idea" are different facts.

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

**Venue Details "Nearby Places" is omitted entirely until `/public/venues/nearby` (or
equivalent) exists.** An earlier interim approach — filtering `/public/venues` to the same
destination client-side — was implemented in Phase 6 and removed on review: it is UI-layer
approximation of "nearby," not real nearby data, and the architecture's rule against
computing or fabricating content in the UI layer applies to it exactly as it does to
ratings or highlights. The section returns once this endpoint is delivered.

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

## 7. Structured content — `opening_hours` ✅ shape confirmed, `beach_details` still open

**Verified against publish revision 1071** (401 venues, 2026-08-02).

- **`opening_hours`** — shape confirmed from the one populated venue (`v00001`, 0.2% of
  the dataset): a day-keyed object (`mon`…`sun`, 3-letter lowercase), each day an array of
  `["HH:MM", "HH:MM"]` 24h ranges — an array, not a single pair, so a split lunch/dinner
  schedule is representable. Implemented in `lib/domain/openingHours.ts`
  (`toOpeningHours`, `isOpenAt`, `formatOpenUntil`) and wired into `Venue.isOpenNow`
  (`VenueCard`'s `StatusBadge`) and Venue Details' hours `InfoPill`. **Real coverage is
  effectively zero (1/401)** — implemented because the shape is now a fact, not a guess,
  but don't expect it to render on more than a handful of venues yet.
- **`beach_details`** — **confirmed 0/401 populated** in this snapshot. Still an open
  question whether it's the intended source for "Why Visit" highlights or unrelated;
  cannot be resolved by inspecting real data since no venue has it set. `highlights: list[str]
  | None` remains the fallback proposal if `beach_details` turns out to serve a different
  purpose.

Also confirmed in this snapshot: **`cover_image_url` and `gallery_image_urls` are 0/401
populated** — every card and gallery in the app is currently rendering its no-image
fallback. This makes §3a (destination imagery) and the venue-level equivalent the most
visually significant gap in the product today, not a theoretical one.

---

## 9. Category taxonomy mismatch — found verifying against real data, fixed in Consumer

**Not a Studio requirement — a Consumer bug, now fixed**, documented here because it
was invisible without real content. The original `VenueCategory` mapper checked the wire
`category` string against Stitch's five literal names (`"beach"`, `"food"`, `"coffee"`,
`"nightlife"`, `"general"`). Real Studio categories, confirmed against 401 venues, are
entirely different strings:

| Real category | Count | Mapped to |
|---|---|---|
| Restaurant | 156 | `food` |
| Cafe | 50 | `coffee` |
| Activity | 39 | `general` |
| Shopping | 33 | `general` |
| Spa | 28 | `general` |
| Hotel | 26 | `general` |
| Services | 20 | `general` |
| Resort | 20 | `general` |
| Beach Club | 19 | `beach` |
| Nightlife | 8 | `nightlife` (only literal match) |
| Other | 2 | `general` |

Before the fix, everything except `Nightlife` fell back to `general` — **100% of
restaurants and cafes** (206 venues, 51% of the dataset) rendered with the wrong map
marker colour and the wrong mood-grid icon. `lib/domain/mappers/venue.ts`'s
`CATEGORY_MAP` now translates the real strings.

**Product question, not a bug:** `Activity`/`Shopping`/`Spa`/`Hotel`/`Services`/`Resort`/
`Other` (168 venues, 42% of the dataset) have no equivalent in Stitch's five-category mood
grid or map marker set at all — they correctly fall to `general`, but that's Stitch having
designed for 5 categories against a real taxonomy of 11, not something a mapper fix can
resolve. Worth a design conversation: does the mood grid need a 6th "More" chip, or a
dedicated marker colour for these?

---

## 10. Other observations from real data — informational, not blocking

- **Bilingual venue names.** Several real names mix Latin and Arabic in one string
  (`"Aklet Samak - اكلة سمك"`, `"Al Agha مطعم الاغا"`). These render legibly today via
  the browser's own font fallback — `--font-sans` (Inter) has no Arabic glyph coverage,
  and `--font-arabic` (IBM Plex Sans Arabic) is never applied to dynamic content, since
  Stitch only used it for the Splash tagline, a fixed string in a known language. Not a
  defect, but worth a deliberate design decision before an Arabic-locale push: detect and
  apply `font-arabic` to venue-facing text, or accept system fallback as sufficient.
- **Possible duplicate content.** Two separate ids in the Marassi food search sample were
  both named "Al Agha" — may be legitimate branches, may be a data entry duplicate. A
  Studio content question, not a Consumer rendering issue.
- **`is_featured` is 1/401.** Home's "Trending Today" will show a single card in this
  snapshot — correct behaviour given the data, not a bug, but worth knowing before judging
  Home's visual density against the Stitch export.

---

## Summary

| # | Requirement | Priority | Blocks |
|---|---|---|---|
| 1 | `rating`, `review_count` | P0 | 6 screens (degraded) |
| 2 | Collections model + endpoints | P0 | Explore (entirely) |
| 3 | Home curation (Hidden Gems only — Trending uses `is_featured`) | P1 | Home Hidden Gems |
| 3a | Destination cover image | **P0** | Home Explore Destinations — before launch |
| 3b | Events content model | P1 | Map bottom sheet 4th stat tile (omitted, not shown as 0) |
| 4 | Nearby endpoint / distance | P1 | Map, Search, Nearby |
| 5 | Weather | P2 | Home weather pill — recommend dropping |
| 6 | Account-dependent UI | — | ✅ Resolved without API work |
| 7 | `opening_hours` ✅ shape confirmed &amp; implemented; `beach_details` still unresolved | P1 | Venue Details |
| 8 | `price_range`, `tags`, `amenities`, `highlights` | P1 | Venue Details |
| 9 | *(Consumer bug, not Studio)* category taxonomy mismatch | — | ✅ Fixed — see §9 |

**Buildable to full fidelity today:** Saved, More, Splash, Onboarding, Search (minus
distance), Map (minus stats and viewport query), Venue Details (minus ratings, price,
amenities, highlights, Nearby distance), Home (minus ratings, weather, place counts).

**Not buildable today:** Explore only — §2 is the single remaining hard content blocker,
and it blocks one screen out of nine.

Every other gap degrades a screen rather than blocking it, because every component is
specified to render correctly when optional data is absent.
