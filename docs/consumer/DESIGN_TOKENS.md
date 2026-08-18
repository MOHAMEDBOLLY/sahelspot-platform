# Consumer — Design Tokens

> **SUPERSEDED (as of the Coastal Editorial Migration, 2026-08).** The
> teal/gold palette and `#F9F9FE` surface documented below predate the
> Coastal Premium palette shipped in `consumer/app/globals.css`
> (`@theme`, top of file), which is the current canonical source of
> truth for Consumer color tokens. In brief, the live tokens are:
> `--color-primary: #0D3B66` (navy, unchanged), `--color-accent: #B9764A`
> (clay/terracotta — replaces this document's teal `#2AA198`/gold
> `#F28705`), `--color-coral: #C0503F` (sparse Events-only accent),
> `--color-cream: #F1EAD9`, `--color-surface: #FFFFFF` (page background —
> replaces this document's `#F9F9FE`). Headline font is Fraunces
> (`--font-headline`), body font is Inter (unchanged). This document is
> kept for historical context (the Stitch-export drift it documents was
> real at the time) but should not be used to implement or review
> current UI — read `globals.css` directly instead.

The canonical token set for the SahelSpot Consumer Website. Values are taken from
`SahelSpot_Developer_Handoff.md` §"Design Tokens (canonical)".

**Rule: literal hex only.** Verified against the Stitch export in
`/Users/Nabil/Downloads/stitch_sahelspot/`. Every screen ships its own inline
`tailwind.config`, and **no two agree**:

| Alias | Home | Explore | Map (canonical) | Canonical value |
|---|---|---|---|---|
| `primary` | `#0D3B66` ✅ | `#0D3B66` ✅ | `#3b618e` ❌ | `#0D3B66` |
| `secondary` | `#2AA198` ✅ | `#2AA198` ✅ | `#006b64` ❌ | `#2AA198` |
| `tertiary` | `#904e00` ❌ | `#F28705` ✅ | `#904e00` ❌ | `#F28705` |
| `surface` | `#f9f9fe` | `#ffffff` | `#f9f9fe` | `#F9F9FE` (page) |
| `cream` | `#F5E6C8` (custom) | — | — | `#F5E6C8` |
| `gold` | `#F28705` (custom) | — | — | = tertiary |

The drift is worse than `SahelSpot_Screen_Audit.md` §2 recorded: it is not confined to
Map and Boca Beach — **Home and Explore disagree with each other on `tertiary` and
`surface`.** Home works around its own wrong `tertiary` by declaring a custom `gold`
alias and using `text-gold` throughout; Explore uses `text-tertiary` for the same
colour. Both render `#F28705`; neither can be trusted as a token.

The canonical column above is authoritative, cross-checked against
`sahelspot_design_system/DESIGN.md`. This app defines every colour as a literal hex
value and never inherits a Stitch alias.

---

## 1. Colour

### Brand
| Token | Value | Role |
|---|---|---|
| `--color-primary` | `#0D3B66` | Navy. Primary actions, active nav, headings, filled CTA. |
| `--color-secondary` | `#2AA198` | Teal. Links, "See All", check icons, OPEN badge. |
| `--color-tertiary` | `#F28705` | Gold. Ratings, saved-heart active, eyebrow labels, food markers. |
| `--color-cream` | `#F5E6C8` | Category tiles, tag pills, empty-state icon tiles. |

Verified in use: Home renders ratings as `text-gold` and the active heart as
`text-gold`; Explore renders the "FEATURED TRAVEL" eyebrow and the "PLAN YOUR DAY"
pill in the same colour. Gold is an accent, never a primary fill.

### Surface
| Token | Value | Role |
|---|---|---|
| `--color-surface` | `#F9F9FE` | **Page** background. Not white — Home and Map both use `#f9f9fe`. |
| `--color-surface-container-lowest` | `#FFFFFF` | **Card** background. |
| `--color-surface-container-low` | `#F2F3FA` | List-row groups, `StatTile`, subtle fills. |
| `--color-surface-container` | `#ECEEF5` | Recessed areas, icon-button hover. |
| `--color-surface-container-high` | `#E5E8F0` | `SearchField/solid` background. |
| `--color-secondary-container` | `#89F5EA` | Weather pill background. |
| `--color-on-secondary-container` | `#005C56` | Weather pill text and icon. |
| `--color-primary-container` | `#9EC3F6` | Avatar placeholder, `CategoryChip` hover. |

The page/card distinction matters: cards are pure white on a very slightly tinted page.
Rendering both as `#FFFFFF` flattens every card in the product.

### Content
| Token | Value | Role |
|---|---|---|
| `--color-on-surface` | `#2E333A` | Body text. |
| `--color-on-surface-variant` | `#5B5F67` | Secondary text, captions. |
| `--color-outline-variant` | `#AEB2BB` | Hairlines — use at 10–30% opacity. |
| `--color-error` | `#A83836` | Error states. |

### Map marker categories
Fixed colour coding, from the Interactive Map screen. Not interchangeable with the
brand scale — these are data encodings.

Read directly from `interactive_map_1/code.html`. Note that the Map screen's own
config resolves `primary`/`secondary`/`tertiary` to the *wrong* values, so its pins
render incorrectly in Stitch — the canonical hexes below are what production must use.

| Category | Colour | Size |
|---|---|---|
| General / selected | `#0D3B66` navy | 40px (`w-10`) |
| Beach | `#2AA198` teal | 32px (`w-8`) |
| Food | `#F28705` gold | 32px |
| Nightlife | `#3730A3` indigo | 32px |
| Coffee | `#7F4400` brown | 32px |
| User location | `#0D3B66` navy | 16px (`w-4`) + pulse |

All markers: `rounded-full`, `border-2 border-white`, `shadow-md` (`shadow-lg` for the
selected 40px pin), white icon glyph. Hover `scale(1.10)`.

---

## 2. Typography

Family: **Inter** for all Latin text. **IBM Plex Sans Arabic** for RTL content only.

> Both families are declared in the Stitch screens, but Arabic is never actually used
> in the markup (`SahelSpot_Screen_Audit.md` §5). RTL support is declared, not
> implemented. The Splash screen's Arabic tagline is the first real use.

Corrected against the export. The handoff document's scale is close but wrong in three
places; the **Actual** column is what the Stitch markup renders and is authoritative.

| Token | Handoff says | **Actual (export)** | Used by |
|---|---|---|---|
| `display-lg` | 36px / 800 | `text-4xl font-extrabold tracking-tighter` — 36px / 800 ✅ | Home "North Coast" |
| `headline-lg` | 30px / 900 | `text-3xl font-black tracking-tight` — 30px / 900 ✅ | Venue Details title ("Boca Beach") — its only use |
| `headline-md` | 24px / 900 | `text-2xl font-black` — 24px / 900 ✅ | Explore title, bottom-sheet title ("Marassi") |
| `headline-sm` | 20px / 800 | `text-xl font-bold` — 20px / **700** ⚠️ | Section headers on **detail** screens |
| `title-md` | 18px / 700 | `text-lg font-bold` — 18px / 700 ✅ | Section headers on **root** screens; card titles |
| `title-sm` | 16px / 700 | 16px / 700 ✅ | |
| `body-md` | 14px / 500 | `text-sm` — 14px / 400–500 ✅ | Body, card meta |
| `label-md` | 12px / 700 | `text-xs font-medium` — 12px / 500 ⚠️ | **Bottom-nav labels**, review counts |
| `label-sm` | 10px / 700 | `text-[10px] font-bold uppercase tracking-wider` ✅ | `CategoryChip` labels, `StatTile` labels |

**Three corrections that matter:**
1. **`SectionHeader` has two sizes**, and Stitch is internally inconsistent about it:
   - Root screens (Home, Explore, Map sheet) → `text-lg font-bold` (18 / 700)
   - Detail screens (Venue Details) → `text-xl font-bold` (20 / 700)

   Both are reproduced faithfully via a `size` prop (`'md'` default, `'lg'` on detail
   screens). This is not a redesign — it is what the two screens actually render. Note
   the weight is **700 in both cases**; the handoff's 800 appears nowhere.
2. **Bottom-nav labels are 12px / 500**, not 10px / 700.
3. `headline-lg` 30 / 900 is **confirmed** by the Venue Details title, and is used
   nowhere else in the product.

Hierarchy order (display → headline → title → body → label) passes audit.

---

## 3. Spacing

4px base grid. Steps in active use:

| Token | Value |
|---|---|
| `xs` | 4px |
| `sm` | 8px |
| `md` | 16px |
| `lg` | 24px |
| `xl` | 32px |
| `2xl` | 48px |

**Screen horizontal padding is `px-4` (16px).** The Boca Beach screen uses `px-5`
(20px), which is off-grid; it is recorded as known debt in the audit and is *not*
reproduced here. Venue Details uses `px-4` like every other screen.

---

## 4. Radius

⚠️ **Stitch overrides Tailwind's default radius scale.** Copying class names from the
export into a stock Tailwind project produces the wrong radii on every card in the app.

| Stitch class | Value | Stock Tailwind | Used by |
|---|---|---|---|
| `rounded-lg` | 8px | 8px ✅ | OPEN badge |
| `rounded-xl` | 12px | 12px ✅ | Secondary buttons |
| `rounded-2xl` | **16px** | 16px ✅ | `CategoryChip`, thumbnails, weather pill, `StatTile` |
| `rounded-3xl` | **24px** | 24px ✅ | **Cards**, `DestinationCard`, bottom nav top, bottom sheet |
| `rounded-full` | 9999px | ✅ | Search field, chips, pills, `IconFAB`, markers |

Values happen to align with stock Tailwind v3/v4, so the scale itself is safe — but note
that **cards are `rounded-3xl` (24px), not 16px**. `DESIGN.md` says "Cards: 16–20px",
which the implementation contradicts; the markup wins.

---

## 5. Elevation

| Token | Value |
|---|---|
| `card` | `shadow-md` |
| `floating` | `shadow-xl` |
| `nav` | `0 -4px 12px rgba(0,0,0,.05)` |
| `sheet` | `0 -10px 40px -15px rgba(0,0,0,.15)` |

---

## 6. Motion

Implemented in **Phase 10**, after functional completeness — per approved guidance,
Framer Motion is added last.

| Token | Behaviour |
|---|---|
| `tap-scale` | `scale(0.90–0.95)`, 100–150ms — every button press |
| `hover-scale` | `scale(1.05–1.10)`, 500–700ms — card imagery |
| `header-shadow` | Fades in once `scrollY > 10–20px` |

All motion must respect `prefers-reduced-motion`.

> **Haptics:** the Explore screen calls `navigator.vibrate(5)` on every button; no
> other screen does (`SahelSpot_Developer_Handoff.md` §Explore). This app standardises
> on **no haptics** — a single unreplicated call on one screen is inconsistency, not
> intent. Flagged for confirmation.

---

## 7. Touch targets

**Minimum 48×48dp for every icon-only control.** The canonical screens contain 40px
instances (Boca Beach back/share/save/chevron; Map locate/layers) which fail the
WCAG 2.5.5 44×44 minimum. These are corrected by construction — the `IconFAB`
component enforces 48dp and there is no smaller variant.

---

## 8. Accessibility rules baked into tokens

Carried from `SahelSpot_Screen_Audit.md` §7. These are component-level guarantees, not
per-screen reminders:

- Images use real `alt`, never Stitch's non-standard `data-alt`.
- Every icon-only control has an `aria-label`.
- Decorative icon rows (e.g. the 5-star hero row next to a numeric "4.8") are
  `aria-hidden`.
- `--color-on-surface-variant` at 60% opacity and 10px labels require a dedicated
  contrast pass before release (flagged Low–Medium risk in the audit, unconfirmed).

---

## Appendix — Tailwind v4 `@theme` (specification, not yet applied)

To be written to `consumer/app/globals.css` in Phase 0.

```css
@theme {
  --color-primary: #0D3B66;
  --color-secondary: #2AA198;
  --color-tertiary: #F28705;
  --color-cream: #F5E6C8;

  --color-surface: #F9F9FE;
  --color-surface-container-lowest: #FFFFFF;
  --color-surface-container-low: #F2F3FA;
  --color-surface-container: #ECEEF5;
  --color-surface-container-high: #E5E8F0;
  --color-primary-container: #9EC3F6;
  --color-secondary-container: #89F5EA;
  --color-on-secondary-container: #005C56;

  --color-pin-nightlife: #3730A3;
  --color-pin-coffee: #7F4400;

  --color-on-surface: #2E333A;
  --color-on-surface-variant: #5B5F67;
  --color-outline-variant: #AEB2BB;
  --color-error: #A83836;

  --font-sans: "Inter", system-ui, sans-serif;
  --font-arabic: "IBM Plex Sans Arabic", sans-serif;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;

  --shadow-nav: 0 -4px 12px rgb(0 0 0 / 0.05);
  --shadow-sheet: 0 -10px 40px -15px rgb(0 0 0 / 0.15);
}
```

The existing starter theme in `globals.css` (Geist font, `--background`/`--foreground`
greys, `prefers-color-scheme: dark` block) is removed in the same phase. **There is no
dark mode** — Stitch defines a single light theme.
