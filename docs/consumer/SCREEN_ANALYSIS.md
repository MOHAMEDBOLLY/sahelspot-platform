# Consumer — Screen Analysis

Nine screens. Four are canonical Stitch screens; five are specified in
`SahelSpot_Remaining_Screens_Spec.md`. Six archived duplicate Map screens are excluded
per `SahelSpot_Screen_Audit.md` §1.

| # | Screen | Route | Stitch ID | Nav role | Bottom nav |
|---|---|---|---|---|---|
| 1 | Home | `/` | `3bf836f2…` | Root tab | ✅ |
| 2 | Explore | `/explore` | `4bfbf2c9…` | Root tab | ✅ |
| 3 | Interactive Map | `/map` | `207897c1…` | Root tab | ✅ |
| 4 | Saved | `/saved` | — (spec) | Root tab | ✅ |
| 5 | Profile | `/more` | — (spec) | Root tab | ✅ |
| 6 | Venue Details | `/venues/[id]` | `a9e7545f…` | Push | ❌ |
| 7 | Search | `/search` | — (spec) | Push | ❌ |
| 8 | Onboarding | `/onboarding` | — (spec) | Standalone | ❌ |
| 9 | Splash | app entry | — (spec) | Standalone | ❌ |

Bottom navigation appears on root-level screens only (approved decision 6). This
corrects the canonical Boca Beach screen, which shows the bottom nav on a push screen.

---

## 1. Home — `/`

**Structure:** sticky header → scrollable main (`space-y-8`) → bottom nav.

| Region | Contents |
|---|---|
| Header | 40px avatar circle, "Good Morning 👋", "SahelSpot" wordmark, notification bell (right) |
| Hero | "North Coast" (`display-lg`) + weather pill (icon + "31°C Sunny", secondary-container bg) |
| Search | `SearchField/solid` full width, `FilterButton` attached right |
| Mood grid | 5× `CategoryChip`, `grid-cols-5`, `gap-3` |
| Trending Today | `SectionHeader` + `CardCarousel` of `VenueCard/vertical-lg` (min-width 280px, `snap-x`) |
| Explore Destinations | `SectionHeader` + 2-col grid of `DestinationCard` (`h-64`, gradient scrim) |
| Hidden Gems | `SectionHeader` + `CardCarousel` of 120×120 rounded thumbnails + caption |

**Interactions:** header gains blur + shadow past 10px scroll; cards take `scale-98` on
touchstart.

**Data:** `GET /public/venues`. Trending, Hidden Gems, weather, and the avatar/greeting
have no API source — see `API_REQUIREMENTS.md` §1, §5, §6.

---

## 2. Explore — `/explore`

**Structure:** sticky header → scrollable main (`px-4`) → bottom nav.

| Region | Contents |
|---|---|
| Header | avatar + "Explore" (`TopAppBar/title`) + notification bell |
| Weekend Planner | full-width banner card `h-44`, gradient overlay, "Plan Your Day" eyebrow + headline + white CTA pill "Open Calendar" |
| Collections | `SectionHeader` + 2×2 bento grid of `CollectionCard` (`h-40`, gradient + label only, no subtitle) |
| Editor's Picks | `SectionHeader` + single feature card (`aspect-[4/5]` mobile), eyebrow + headline + body + primary `CTAButton` "View Collection" |
| Quick Browse | plain section title (no "See All") + `CardCarousel` of 5 circular icon chips (`w-16 h-16 rounded-2xl`) |

**Data:** Collections, Editor's Picks, and Weekend Planner have **no content model at
all** in Studio. This is the single largest API gap — see `API_REQUIREMENTS.md` §2.

**Note:** `navigator.vibrate(5)` fires on every button on this screen and nowhere else.
Not replicated — see `DESIGN_TOKENS.md` §6.

---

## 3. Interactive Map — `/map`

**Structure:** map layer (z-0) → floating overlays (z-20) → bottom sheet (z-30) →
bottom nav (z-50).

| Region | Contents |
|---|---|
| Map layer | Stitch: background-image illustration + `top/left %` pins + pulsing user-location dot (2s ease loop). **Production: Mapbox GL JS.** |
| Markers | circular `w-8/10 h-8/10`, white 2px border, 5 category colours |
| Floating search | `SearchField/glass` + `FilterChip` row, `p-4` overlay |
| Floating controls | 2× `IconFAB` (locate, layers), `right-4 top-1/2 -translate-y-1/2` |
| Bottom sheet | drag handle → title/close row → `StatTile` `grid-cols-4` → `SectionHeader` + `CardCarousel` of `VenueCard/vertical-compact` |

**Interactions:** search focus adds `ring-2 ring-primary/20` to the parent pill. The
Stitch drag handle is visual only — no sheet physics.

**Highest-risk screen.** Stitch's "map" is a static illustration with
percentage-positioned pins; production is a real interactive Mapbox surface. Marker,
overlay, sheet, and control styling can match exactly; the map substrate cannot. Isolated
as its own feature module (approved guidance).

**Data:** `GET /public/venues` with `latitude`/`longitude`. Both are `str | None` — venues
without coordinates must be excluded. `StatTile` values and a nearby/bbox query are gaps.

---

## 4. Saved — `/saved`

**Structure:** sticky header ("Saved", `headline-sm`, navy, no back arrow + sort `IconFAB`)
→ `TabBar` segmented (Favorites / Collections / Want to go) → vertical list of 4×
`VenueCard/vertical-lg` with heart pre-filled → bottom nav, Saved active.

**✅ Resolved — device-local only.** Saved is backed by `localStorage`: no login, no cloud
sync, no user account. This is device preference state, not user data, so it does not
contradict the no-accounts decision and introduces no second backend.

It is isolated behind a service interface so a future authenticated implementation
replaces it without touching the UI layer:

```ts
// lib/saved/types.ts
interface SavedRepository {
  list(): Promise<string[]>;
  has(venueId: string): Promise<boolean>;
  add(venueId: string): Promise<void>;
  remove(venueId: string): Promise<void>;
  subscribe(fn: (ids: string[]) => void): () => void;
}
```

`LocalStorageSavedRepository` is the only v1 implementation. Components consume a
`useSavedVenues()` hook and never touch `localStorage` directly. The stored value is a
list of venue ids; venue content is always re-fetched from `/public/venues`, so the
Studio API remains the single source of truth for content.

The `TabBar` (Favorites / Collections / Want to go) renders with only **Favorites**
populated in v1; the other two are `EmptyState` — they require collections and
multi-list support that do not exist yet.

---

## 5. More — `/more`

Labelled **"More"** with a `menu` (hamburger) icon in the exported bottom nav — not
"Profile", as the remaining-screens spec calls it.

**✅ Resolved — application-level items only.** The user row and the entire Account group
(My Bookings, Notifications, My Reviews, Visited Places) are removed; they require
accounts, which v1 does not have.

**Structure:** `TopAppBar/title` ("More") → `ListRowItem` groups → bottom nav, More active.

| Group | Items |
|---|---|
| **Preferences** | Language (trailing "English"), Theme |
| **About** | About SahelSpot, Privacy Policy, Terms of Service |
| **Support** | Contact |
| **Share** | Share App, Rate App |

Every item is static content or a device-level action — no API, no account. Share App
uses the Web Share API with a copy-link fallback.

> **Theme:** the row exists per the approved item list, but Stitch defines **one light
> theme and no dark mode**. In v1 this row is either omitted or shown as "System" and
> disabled. Flagged in `ROADMAP.md` — it does not block Phase 0.

---

## 6. Venue Details — `/venues/[id]`

**Structure:** hero image (`h-80`) → content (`px-4`, corrected from Stitch's off-grid
`px-5`) → **no bottom nav** (approved decision 6).

Fully validated against `/Users/Nabil/Downloads/stitch_sahelspot 2/`. Section spacing on
this screen is `space-y-6` (24px), not the root screens' `space-y-8`.

| Region | Contents |
|---|---|
| Hero | `h-80` image + `hero-gradient`; back `IconFAB` top-left; share + save (gold, filled) top-right; "1/15" counter bottom-right |
| Header info | title `text-3xl font-black` navy + location; `RatingStars` (4.8 → stars → "(230 reviews)"); 2× cream `rounded-full` tag pill ("Beach Club", "Beachfront") |
| Info pills | 4× `InfoPill`, horizontal scroll — hours, price range, distance, family-friendly |
| Actions | `CTAButton` "Directions" `h-12` flex-grow + 3× `IconActionButton` 48dp outlined (call / WhatsApp / website) |
| Why visit? | `SectionHeader size="lg"` + "See All" + 4× `ChecklistRow` |
| Gallery | `SectionHeader size="lg"` + "See All" + 3× `w-32 h-32 rounded-2xl` thumbs |
| Nearby Places | `SectionHeader size="lg"` + "See All" + 1× `VenueCard/horizontal-row` |

**Data:** `GET /public/venues/{id}` covers hero, gallery, title, destination, category
tag, and all three contact actions (`phone`, `whatsapp`, `website`, plus `maps_url` for
Directions). Gaps: rating and review count, price range, amenity tags, "Why visit?"
highlights, and Nearby distance — all recorded in `API_REQUIREMENTS.md`.

The save (heart) control writes to the device-local Saved service (see §4).

**Two Stitch defects on this screen, both corrected by approved decision:**
- The bottom nav is present **with Explore marked active** — plainly wrong on a venue
  detail. Removed entirely (decision 6).
- Content padding is `px-5`, off the 4px grid. Corrected to `px-4`.

**404:** `null` from the API renders the existing not-found page — the URL scheme and
404 semantics in `docs/adr/0001-public-venue-urls.md` are unchanged.

---

## 7. Search — `/search`

**Structure:** sticky header (back `IconFAB` + focused `SearchField/solid` +
`FilterButton`) → Recent Searches → Popular Categories → `FilterChip` row → Results →
vertical list of `VenueCard/horizontal-row` → **no bottom nav**.

Placeholder: "Search for places, beaches, cafes…".

**States:** default (recent + categories, no query) · results · empty · loading.

**Data:** `GET /public/search/venues?q&category` exists and is sufficient for the core
flow. Result-count label works. Recent Searches is device-local (`localStorage`) and is
*not* user data — it needs no backend. Per-result distance is a gap.

---

## 8. Onboarding — `/onboarding`

Three structurally identical slides; only image, headline, subtext, and button label vary.

Per slide: "Skip" link (top-right, teal) → large rounded image (~60vh) → navy headline
(`headline-sm`) + grey subtext (`body-md`, max 2 lines) → `PageDots` (active dot elongates
to `w-6 h-2`; inactive `w-2 h-2` grey) → full-width navy `CTAButton` pill.

| # | Image | Headline | Button |
|---|---|---|---|
| 1 | Beach club scene | Discover Amazing Places | Next |
| 2 | Map/pin illustration | Explore with the Map | Next |
| 3 | Saved/heart illustration | Save Your Favorites | Get Started |

**⚠️ Slide 3 advertises a feature that will not exist** if Saved is deferred. Content
must change if that decision goes that way.

Implemented as one route with client-side slide state — not three routes. `PageDots` is
distinct from the numeric "1/15" gallery counter on Venue Details.

---

## 9. Splash — app entry

Full-bleed cream `#F5E6C8` background → centred `LogoLockup` (circular compass/leaf mark
in teal + gold, ~64–80px; "SahelSpot" `headline-lg` navy; "Discover the North Coast"
`body-md` grey; Arabic "اكتشف الساحل الشمالي" in IBM Plex Sans Arabic, `dir="rtl"`) →
subtle navy loading indicator at the bottom.

**Web reality check:** a timed splash screen is a native-app pattern. On the web it delays
first contentful paint and harms SEO on the most important route. Recommended as a brand
loading state during initial data fetch rather than a mandatory ~1.5–2s gate. Flagged in
`ROADMAP.md` §Open Decisions.

The only asset here that does not exist yet is the logo mark itself.

---

## Cross-cutting

**Shared shells.** Screens 1–5 share a root-tab shell (sticky header + scroll region +
bottom nav). Screens 6–7 share a push shell (no bottom nav). Screens 8–9 are standalone.
Three layouts, nine screens.

**Desktop.** Every Stitch screen is a phone screen. Per approved decision 2, mobile is
implemented exactly as specified first; desktop adaptations follow in Phase 11, preserving
the same design language — same tokens, same components, same content hierarchy, no new
visual vocabulary. Bottom nav becomes a top nav above the `md` breakpoint; carousels
become grids; the map bottom sheet becomes a side panel.

**Validation gate.** Stitch could not be opened directly (the editor renders blank under
browser automation). Every screen above is derived from the handoff specifications. Per
approved decision 7, each major screen must be validated against Stitch before its
implementation phase begins.
