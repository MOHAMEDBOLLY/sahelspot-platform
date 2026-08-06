# SahelSpot Mobile 2027 — Design Freeze Report

**Status: FROZEN.** This document is the official visual-language baseline for SahelSpot Mobile 2027, effective 2026-08-06.

**Consumer implementation status:** The `consumer/` Home screen (`app/(root)/HomeClient.tsx` and every component it composes — Hero, Search, Categories, Best Beaches, Explore Destinations, Trending Today, Upcoming Events, Food Picks, Nightlife) passed Home Design QA on 2026-08-06 and is now **approved and frozen as the reference implementation** for visual language, the card system, search, typography, spacing, color discipline, and component hierarchy for the rest of the application. Do not revisit it except to fix a confirmed regression. Baseline commit: `6b1a4e55bc74d656ede575e42fa9414cc4c8137a` (pre-Home-completion state; a follow-up commit captures the Home-completion changes above it). It supersedes all prior in-progress design decisions made during the Stitch exploration phase. No screen, component, token, or rule listed as "Approved" below may change without an explicit, separate unfreeze decision.

Stitch project: `SahelSpot Mobile 2027` — `projects/11511878731912312859`.

This is a documentation snapshot only. No screens were modified, redesigned, or generated in the course of producing this report.

---

## 1. Canonical Design System

Single design system asset, in active use by every approved screen:

- **Asset ID:** `assets/16664307474031866498`
- **Display name:** SahelSpot Mobile 2027
- **Color mode:** Light only (no dark mode — see §7 Outstanding Items)
- **Headline font:** Space Grotesk
- **Body / label font:** Inter
- **Roundness token:** ROUND_TWELVE (card-family radius ≈ 20–24px; full-pill reserved for primary CTAs and chips)

### Color tokens (final, v3+)

| Role | Value | Notes |
|---|---|---|
| Primary / Navy | `#0D3B66` | Dominant palette — backgrounds, text, primary fills |
| Surface / White | `#FFFFFF` | Card and panel surfaces |
| Accent / Summer Yellow | `#FFC94A` | The **only** accent color. Structural use only — see Design Rule 1 |

Retired, do not reintroduce: Cyan/Aqua (`#00C2D1`) and Electric Coral (`#FF5A4E`) — used in an earlier iteration, explicitly superseded by the yellow-only palette.

A second, unused design-system asset (`assets/9a67e1ce777c4515ab4b1f17040199e7`, "Mediterranean Modernist") exists in the project from an accidental generation. It is not referenced by any canonical screen and should be treated as orphaned, not a variant system.

---

## 2. Canonical Screen IDs

The single source of truth for each production route. Any other screen ID present in the Stitch project (`get_project` on `projects/11511878731912312859`) that is not listed here is non-canonical — see §7.

| # | Screen | Route | Canonical Screen ID | Verification |
|---|---|---|---|---|
| 1 | Home | `/` | `f4879e5c715d431c98dc816c9203a4e0` | Pixel-verified, **except bottom-nav active state — see note below** |
| 2 | Explore | `/explore` | `7d934167098745ad9746de6638486a35` | Pixel-verified, **except bottom-nav active state — see note below** |
| 3 | Interactive Map | `/map` | `3a4be6177b4e424fb95eba6896cd536d` | Pixel-verified (rebuilt, includes underline active-tab treatment) |
| 4 | Saved | `/saved` | `d73f956a623141a5b2e629b5bcd16b1b` | Pixel-verified — source of the canonical card DNA; includes underline active-tab treatment |
| 5 | More | `/more` | `615556f185604045a058b70ce0abebc9` | Pixel-verified (rebuilt, includes underline active-tab treatment) |
| 6 | Venue Details | `/venues/[id]` | `0abec836db054ddc966d4423f995f60d` | Pixel-verified (corrected) |
| 7 | Search | `/search` | `2fce9ef803ef419294ae0054fe2b2580` | Pixel-verified (rebuilt) |
| 8 | Onboarding | `/onboarding` | `0387eb889c8e488ca202f9f348663981` | **Not frozen** — see §7. Only Slide 1 of 3 exists |
| 9 | Splash | app entry | `5228bf663af94774844833035aac81e9` | Pixel-verified |

Screens 1–5 use the root-tab shell (bottom nav). Screens 6–7 use the push shell (no bottom nav). Screens 8–9 are standalone.

---

## 3. Approved Component Inventory

### 3.1 The Card System — one family, five variants

All variants share: rounded-photo shape language (~20–24px radius), the yellow save badge, the yellow triangular corner accent, an inset/floating info surface (never flush text-on-background), Space Grotesk name / Inter location typography, and identical visual hierarchy logic. Variants differ in **size and density only** — never in shape language, accents, or surface treatment.

| Variant | Construction | Used on |
|---|---|---|
| **1. Featured Card** | Large image, full floating panel overlapping the photo's bottom edge with visible inset margin | Home hero sections, Explore's Editor's Choice |
| **2. Standard Card** | Same construction as Featured, smaller footprint | Best Beaches, Trending, Food Picks, Nightlife, Destination cards |
| **3. Compact Horizontal Card** | Small square thumbnail (~64–80px), inline name/location text beside it, chevron trailing. Save badge + corner accent scaled down onto the thumbnail. Must never expand into a large photo card | Venue Details → Nearby Places |
| **4. Search Result Card** | Same construction as Variant 3 — reused, not a separate design | Search results list |
| **5. Event Card** | Same construction as Standard Card, with an additive status tag + date line | Upcoming Events |

**Save affordance (fixed):** filled circular yellow badge, navy bookmark icon, top-left of the photo — this exact position and shape everywhere.

**Corner accent (fixed):** small yellow triangular mark, top-right of the photo — present on every card in the system.

### 3.2 Search — "Layered Dock Search"

A signature component, not a generic input: a white rounded-rect surface (card-family radius, not a pill) resting on a visible yellow structural base layer that peeks from beneath one edge — reads as a physical object, not a bordered input. A separate solid-yellow filter capsule (navy sliders icon) is docked to its right edge as its own functional object, not an inline icon. Used identically on Search and Interactive Map.

### 3.3 Section Headers

Bold navy Space Grotesk title + a fixed small yellow underline/tick mark (~24px wide) directly beneath it. "See All" links, where present, align consistently to the right. Applied uniformly across Home, Explore, Search, Venue Details, and More.

### 3.4 Bottom Navigation

Exactly 5 tabs, exact order and labels: **Home, Explore, Map, Saved, More.** Never 4 tabs; never "Profile" in place of "More." Present only on the 5 root-tab-shell screens.

**Active-tab treatment (v2, current/official):** No filled circle, pill, or background shape of any kind — that treatment is retired as too heavy/Material. The active tab is: icon in Summer Yellow (#FFC94A, no background behind it), label in Summer Yellow, and a thin (1–2px) yellow underline directly beneath the label, sized to the label's own text width — not a full-width bar. Reads as quiet and editorial, closer to an underlined text link than a Material floating-action selected state. Inactive tabs are unchanged: navy/muted icon and label, no underline. See §7 for a known exception to where this is actually rendered in Stitch.

### 3.5 Badge System

- Save badge: filled yellow circle, navy bookmark icon, top-left of card photos.
- Status badges (e.g. "Featured", "CLOSED", "Upcoming"): solid-fill pill labels, positioned per screen spec, not part of the yellow system unless marking an actionable state.

### 3.6 Icon Style

Material Symbols Outlined line icons, navy by default; filled/yellow only when marking the single actionable point of a component (see Design Rule 1).

---

## 4. Approved Design Rules

These are binding, not stylistic suggestions:

1. **Yellow is structural, never decorative.** It marks exactly one thing per component: the save action on a card, the filter action on a search bar, the "more content" link on a section header, the active tab on bottom nav, the active state on a filter chip. Yellow must never appear as a random highlight, divider, or fill unconnected to an actionable point. (This rule was violated and corrected twice during QA — on Venue Details "Why visit?" checkmarks, and on Interactive Map's data markers.)
2. **The Card System is frozen at 5 variants.** New card needs are met by choosing the correct existing variant, scaled — never by inventing a sixth.
3. **No second visual language, ever.** Every future screen inherits color, typography, card system, search system, section headers, bottom nav, badges, save affordance, icon style, shape language, elevation, and corner radius automatically from `assets/16664307474031866498`. New component variants are introduced only when a screen has no existing analog, and even then are built from the locked primitives.
4. **Screenshots are the source of truth, not tool response text.** Every edit must be verified by downloading the actual rendered HTML/screenshot and visually confirming the change before it is reported complete. This project has a confirmed history of `edit_screens` reporting detailed, plausible-sounding success while making zero actual change to the stored screen (occurred twice on the original Search screen, once on More). When an in-place edit cannot be verified as applied, the correct response is to regenerate the screen fresh via `generate_screen_from_text`, not to keep retrying the same edit path.
5. **Compact ≠ shrunk Featured.** Variant 3/4 must preserve its production information density; "inheriting more DNA from the featured card" means shape language and accents transfer, not size.

---

## 5. Visual Principles

- **Photography carries the color.** UI chrome stays restrained (white/navy/yellow only) so venue and destination photography supplies the visual richness of every screen.
- **Confident, distinctive headline type.** Space Grotesk gives the brand geometric character that a default humanist sans would not.
- **Premium spacing and generous touch targets**, especially on the search component and primary CTAs.
- **Depth through construction, not decoration.** Elevation comes from real layered/floating panel logic (cards, search dock) rather than generic drop shadows.
- **No promotional or marketing copy anywhere in the product UI.** Headers are functional ("Good Morning", "North Coast", a venue name) — never slogans.

---

## 6. Brand Rules

- Palette is strictly white / navy (`#0D3B66`) / Summer Yellow (`#FFC94A`) — no other brand colors.
- The visual language was derived entirely from SahelSpot's own product and documentation — no external app (Airbnb, Booking, Apple Wallet, TripAdvisor, etc.) or generic template pattern was used as a reference during design.
- No AI, concierge, or other invented features were added at any point — every screen reflects only documented, approved product functionality.
- The existing weather pill, save-to-device (localStorage) behavior, and all other locked product behaviors from `docs/consumer/SCREEN_ANALYSIS.md` remain unchanged — this freeze covers visual language only, never product scope.

---

## 7. Outstanding Items

Items that must be resolved before the product-wide QA pass can be considered complete:

0. **[Deferred QA — functional, not visual] Verify all data-driven visual states using real production data.** The Home screen's Design QA (2026-08-06) validated the visual system only; it did not validate every conditional visual state against real API data, since not all states are represented in current sample data. Specifically still needing verification against real data:
   - Open
   - Closed (the dimmed-card / grayscale-image / red "Closed" ribbon treatment on `VenueCard`'s `vertical-lg` — implemented and code-reviewed, but no currently-loaded venue exercises it)
   - Featured
   - Upcoming
   - Sold Out (if applicable — confirm whether this state exists in the domain model at all before treating its absence as a gap)
   - Missing image (fallback rendering)
   - Missing rating (fallback rendering)
   - Missing place count (fallback rendering)

   This does not block the Home freeze — Home is approved and frozen on visual-system grounds. This item is functional QA, tracked separately, to be picked up when representative data is available.

1. **Home and Explore retain the previous active navigation treatment due to a verified Stitch edit pipeline failure.**

   > Home and Explore retain the previous active navigation treatment due to a verified Stitch edit pipeline failure.
   > This is a tooling limitation, not a design decision.
   > The implementation in the Consumer application must use the official Bottom Navigation specification defined in the frozen Design System (§3.4), not the outdated rendered navigation shown in these two Stitch screens.

   This exception applies only to the Stitch artifact. The implementation must follow the Design System, not the stale render.

   Verification detail: two independent `edit_screens` attempts on each of Home (`f4879e5c715d431c98dc816c9203a4e0`) and Explore (`7d934167098745ad9746de6638486a35`) returned detailed, plausible success responses while making zero actual change to the stored screen HTML (confirmed by comparing the returned file ID before and after each attempt — identical both times, on both screens, across two separate attempts each). This is the same failure class documented in Design Rule 4. Given Home and Explore are the two most refined, highest-fidelity screens in the project, a full `generate_screen_from_text` rebuild was assessed and explicitly rejected — the risk of content drift outweighs the benefit of this one visual refinement. **No further attempts should be made to edit or regenerate these two screens.** They are frozen as-is for v1.0, active-nav styling included, by explicit decision.

2. **Onboarding is incomplete and not yet in scope.** Only Slide 1 of the documented 3-slide flow exists (`0387eb889c8e488ca202f9f348663981`). Per direct instruction, Onboarding work is deferred until the core application (screens 1–7 above) is fully finalized — it should reflect the final visual language, not help define it.
3. **Non-canonical screens remain in the Stitch project.** No delete-screen tool is available via MCP (only whole-project deletion), so the following stale/duplicate/exploratory screens are still visible in the Stitch UI and must be manually removed there if a clean canvas is wanted:
   - Home: `44aea1546700404fb23342d825f5f4ee`, `6855e5dfb5174d1e9540eefe97ce0bdc`, `e06facc5321f4fa298cd4f2ee63fae21`, `d54e90a5105d44cfa979e36556c7830d` (Superseded)
   - Venue Details: `51f9bf75efe943baabfed406f1d7f3d1` (Superseded), `668e734c013544c1a71dc93a67ef6965` (Duplicate)
   - Explore: `5081dfa2ef4f4dfc88d98c9f191e3da6` (Superseded)
   - Search: `431a70802adb4308bbdf4ad2822a08e5` (Superseded — broken edit pipeline)
   - Interactive Map: `80f859e9c3574939855e67e2cc1c7686` (Superseded — missing-Home-tab IA bug), `2e16e36f66e94627b75d780875567f88` (Superseded — replaced by `3a4be6177b4e424fb95eba6896cd536d` for the nav active-state fix)
   - More: `715f95771d514234a4b15ecd138f7001` (Superseded — broken edit pipeline), `9a71afeeded0465c98c1abd1314dd10e` (Superseded — replaced by `615556f185604045a058b70ce0abebc9` for the nav active-state fix)
   - `b6e29cf0d50640de8612943a17e1f25d` "Venue Card Exploration Board" (Exploration artifact, never production)
   - `d98f5becca3646e7a74275579ae17654` "SahelSpot Compass Logo" (Ignore — image asset, correctly embedded in Splash, not a screen)
   - `assets/9a67e1ce777c4515ab4b1f17040199e7` "Mediterranean Modernist" (Ignore — orphaned, unused design system)
4. **Local temp QA artifacts.** Several temporary rendering folders used for pixel-verification during this session (`.tmp_qa2`, `.tmp_qa3`, `.tmp_board`, `.tmp_navfix`, `.tmp_navfix2`) may remain on disk at repo root if locked by an open browser tab at session end. They contain only downloaded HTML/screenshot copies for verification purposes and are not part of the product — should be deleted once unlocked, and are already git-ignorable (not committed).
5. **Full Design QA pass has not yet run.** This freeze establishes the baseline; the cross-screen consistency review is the next step, not yet performed.

---

## 8. Deferred Improvements

Noted for later, explicitly not in scope now:

- **Onboarding** (3-slide build-out) — deferred until core product QA is complete, per direct instruction.
- **Dark mode** — Stitch source defines one light theme only; `docs/consumer/SCREEN_ANALYSIS.md` §5 already flags this as an open decision for the "Theme" row on the More screen (shown disabled/"System" in v1). Not part of this visual-language freeze.
- **Desktop adaptation** — Per `docs/consumer/ROADMAP.md`, desktop follows in Phase 11 using the same tokens/components/hierarchy established here, with layout-only adaptations (bottom nav → top nav, carousels → grids, Map's Liquid Morph preview → side panel). No new visual vocabulary permitted when that phase begins.
- **Interactive Map production substrate** — the Stitch/rebuilt version uses a static styled map illustration; per `docs/consumer/SCREEN_ANALYSIS.md` §3, production replaces this with real Mapbox GL JS. Marker, overlay, and control styling established in this freeze should carry over exactly (see §9 for the Map interaction model); the map tile/imagery layer itself is out of scope for visual-language work.
- **Motion/interaction polish** — elevation and layering rules are defined structurally (§4–5) but no motion specification has been produced yet.

---

## 9. Map Interaction Model

**Status: Permanent design decision, not deferred work.**

The Interactive Map's marker-selection flow is fixed as follows and is not open for reinterpretation during the remainder of the Mobile 2027 migration:

1. **Marker selection uses the Liquid Morph Preview.** Tapping a venue marker morphs it in place into an expanded preview chip (`createPreviewChipElement`) — the marker itself grows and reshapes into the chip; nothing is replaced or overlaid separately.
2. **The preview is the only intermediate interaction surface.** There is no other selected-state UI between a marker and Venue Details — no bottom sheet, no side panel, no list drawer.
3. **Venue Details is the next navigation destination.** Tapping the Liquid Morph Preview navigates directly to `/venues/[id]`. This is the map's only navigation target — the map never navigates to a destination, only ever to a venue (see §2).
4. **No Bottom Sheet exists in Mobile 2027 by design.** This has been evaluated and explicitly rejected, not left incomplete: a bottom sheet would introduce a second intermediate interaction surface and a different product flow than Marker → Liquid Morph Preview → Venue Details, which is out of scope for this migration. Accordingly:
   - No Bottom Sheet is added to the Map screen.
   - No "Popular Nearby" strip is introduced on Map.
   - No `VenueCard` `vertical-compact` (or any other variant) is injected into Map.

Any future proposal to add an intermediate surface to Map is a product-flow change, not a visual migration task, and requires a new, separate, explicit decision — it is not achievable by extending this freeze.

---

*This report reflects project state as of the screen IDs and rules above. Any change to a canonical screen, the design system asset, or an approved rule requires a new dated revision of this document.*
