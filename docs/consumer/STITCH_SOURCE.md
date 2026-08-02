# Consumer — Stitch Source Provenance

The Stitch editor cannot be inspected directly (it renders blank under browser
automation). The authoritative source is the export at
`/Users/Nabil/Downloads/stitch_sahelspot/` — HTML + PNG per screen, plus
`sahelspot_design_system/DESIGN.md`.

**This export should be committed into the repository.** It currently lives in a
Downloads folder outside version control, which makes the visual source of truth
unversioned and machine-local.

---

## Export contents

| Directory | `<title>` | Verdict |
|---|---|---|
| `sahelspot_home` | SahelSpot - Home | ✅ **Canonical — Home** |
| `explore_sahelspot` | SahelSpot - Explore | ✅ **Canonical — Explore** |
| `interactive_map_1` | SahelSpot - Explore the North Coast | ✅ **Canonical — Map** |
| `interactive_map_2` | SahelSpot - Interactive Map | 🗑️ Blank map area |
| `interactive_map_3` | SahelSpot - Interactive Map | 🗑️ Blank map area |
| `interactive_map_4` | SahelSpot - Interactive Map | 🗑️ Blank map area, drifted nav |
| `interactive_map_5` | SahelSpot - Explore North Coast | 🗑️ Partial |
| `interactive_map_6` | SahelSpot - Interactive Map | 🗑️ Partial |
| `map_shell` | SahelSpot - Map Shell | 🗑️ WIP shell, no map |
| `sahelspot_design_system` | — | ✅ `DESIGN.md` brand reference |

### Identifying the canonical Map

`SahelSpot_Screen_Audit.md` labels the canonical Map `207897c1…` with the title
"Interactive Map", which would point at `interactive_map_2/3/4/6`. **All four render a
blank map area.** The only export containing an actual map illustration with
category-coloured pins, the `user-location-pulse` animation, and a populated bottom
sheet is `interactive_map_1` — despite its title being "Explore the North Coast".

`interactive_map_1` is therefore treated as canonical, on evidence rather than title.
`interactive_map_4` also defines the pulse animation but never uses it.

⚠️ Confirm this identification before the Map phase begins.

---

## ✅ Resolved: Venue Details (Boca Beach)

Delivered as a second export at `/Users/Nabil/Downloads/stitch_sahelspot 2/`
(`<title>Boca Beach - SahelSpot`, 315 lines). Its `DESIGN.md` is byte-identical to the
first export's. All four canonical screens are now present.

Everything previously unverified is now confirmed from markup:

| Previously unverified | Confirmed |
|---|---|
| `headline-lg` 30 / 900 | ✅ `text-3xl font-black` — the title is the only use in the product |
| `RatingStars` | ✅ number **first**, then 5 gold stars, then review count — and it uses **`star_half`** |
| `InfoPill` | ✅ `bg-surface-container px-3 py-2.5 rounded-xl border-outline-variant/10`, teal 20px icon |
| "Why visit?" checklist | ✅ `w-5 h-5 rounded-full bg-brand-teal/10` + 16px teal check |
| `ImageGallery` | ✅ `w-32 h-32 rounded-2xl` thumbs; "1/15" = `bg-black/40 backdrop-blur-sm rounded-full` |
| `VenueCard/horizontal-row` | ✅ fully specified — unblocks Search too |
| `px-5` off-grid padding | ✅ confirmed present; corrected to `px-4` per approved deviation |

The screen confirms its own token drift exactly as the audit predicted: `primary`
`#3b618e`, `secondary` `#006b64`, `tertiary` `#904e00`, all masked by custom
`brand-navy` / `brand-teal` / `brand-gold` / `brand-cream` aliases carrying the correct
values. It is the only screen using the `brand-*` naming.

### New findings from this screen

1. **Section headers are `text-xl` (20px / 700) here**, but `text-lg` (18px / 700) on
   Home and Explore. A genuine inconsistency between root and detail screens —
   see `DESIGN_TOKENS.md` §2.
2. **Section spacing is `space-y-6` (24px)**, not Home's `space-y-8` (32px).
3. **Container is `max-w-md`** (448px), not Home/Explore's `max-w-7xl`.
4. **Secondary action buttons are `w-12 h-12` (48dp)** — outlined, not filled. This
   screen is *correct* on touch targets for its action row; only the hero FABs are 40px.
5. **WhatsApp uses an inline brand SVG** at `#25D366`, not a Material Symbol.
6. Bottom nav is present **with Explore marked active** — an outright Stitch bug on a
   venue detail screen. Removed entirely under approved decision 6.
7. Tag pills are `rounded-full`, not `rounded-lg`.
8. Hero uses a named `hero-gradient`:
   `linear-gradient(to bottom, rgba(0,0,0,.3) 0%, transparent 20%, transparent 80%, rgba(0,0,0,.4) 100%)`

---

## Verified findings that contradict the handoff docs

| # | Handoff / DESIGN.md says | Export shows |
|---|---|---|
| 1 | `tertiary` = `#F28705` | Home and Map resolve it to `#904e00`; Home compensates with a custom `gold` alias |
| 2 | Token drift affects Map + Boca Beach only | Home and Explore also disagree — on `tertiary` and `surface` |
| 3 | `surface` = `#FFFFFF` | Page is `#f9f9fe`; cards are `#ffffff` (`surface-container-lowest`) |
| 4 | Section titles are `headline-sm` 20/800 | `text-lg font-bold` — 18 / 700 |
| 5 | Nav labels are `label-sm` 10/700 | `text-xs font-medium` — 12 / 500 |
| 6 | Cards 16–20px radius | `rounded-3xl` — 24px |
| 7 | 5th nav tab is "Profile" | **"More"**, `menu` (hamburger) icon |
| 8 | Home `VenueCard` = image + title + rating | Also an **OPEN/CLOSED status badge** and a **location row with pin icon** |
| 9 | `DestinationCard` = image + title | Also a **place count** ("124 Places") |
| 10 | Map cards show name + category | Also **distance** ("Beach Club • 1.2 km") |
| 11 | `StatTile` is uniform | Each has its own accent colour; one tile renders **highlighted** (cream/gold) |
| 12 | Explore Quick Browse chips are circular | White `rounded-2xl` squares with coloured icons |

Items 8–11 are new component requirements. Items 8 and 10 are also new **API**
requirements — see `API_REQUIREMENTS.md`.

---

## Newly discovered API requirements

| Requirement | Field | Screen |
|---|---|---|
| Open/closed status | derivable from `opening_hours`, or explicit `is_open_now` | Home, all cards |
| Place count per destination | `venue_count` on `PublishedDestination` | Home Explore Destinations |
| Destination stats | places / dining / beaches / events counts | Map bottom sheet |
| Distance | see `API_REQUIREMENTS.md` §4 | Map, Search |

`PublishedDestination` currently exposes only `id`, `name`, `region`, `aliases`,
`boundary` — no counts of any kind.

---

## Confirmed by the export

- Bottom nav markup is near-identical across Home, Explore, and Map — safe to build first
- `data-alt` instead of `alt` on **every** image, exactly as the audit reported
- Heart buttons are `w-10 h-10` (40px) — fails the 48dp minimum, as flagged
- `hide-scrollbar`, `snap-x`, and `-mx-4 px-4` carousel bleed are consistent everywhere
- The scroll-shadow header script is identical across screens
- `darkMode: "class"` is configured but `<html class="light">` — no dark mode ships
