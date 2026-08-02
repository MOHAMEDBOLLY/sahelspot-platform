# Consumer — Design System

How the tokens in `DESIGN_TOKENS.md` and the components in `COMPONENT_INVENTORY.md` are
composed. Tokens define the vocabulary; this document defines the grammar.

---

## 1. Layout shells

Nine screens, three shells. A screen never renders its own chrome.

### Root-tab shell — `app/(root)/layout.tsx`
Home · Explore · Map · Saved · More

```
sticky TopAppBar
scrollable main   px-4, space-y-8, pb = nav height + safe-area
fixed BottomNav   shadow-nav
```

### Push shell — `app/(push)/layout.tsx`
Venue Details · Search

No bottom nav (approved decision 6). Back affordance is a hero `IconFAB` (Venue Details)
or a header `IconFAB` (Search). `pb` = safe-area only.

### Standalone
Splash · Onboarding. No chrome at all.

Because `BottomNav` is rendered only by the root-tab layout, it is structurally impossible
for it to appear on a push screen.

---

## 2. Spatial rules

| Rule | Value |
|---|---|
| Screen horizontal padding | `px-4` (16px) — universal, including Venue Details |
| Vertical rhythm between sections | `space-y-8` (32px) |
| Gap inside a section | `gap-3` / `gap-4` |
| Card carousel item gap | `gap-4`, `snap-x` |
| Grid gutters | `gap-3` (chips) / `gap-4` (cards) |

Full-bleed elements — hero images, gradient banners, the map — break `px-4` by design and
are the only things that may.

Content must clear `env(safe-area-inset-bottom)` above the fixed nav.

---

## 3. Breakpoints

Mobile is the base and is implemented exactly as Stitch specifies. Desktop adapts the same
language in Phase 11 — same tokens, same components, same hierarchy, no new visual
vocabulary.

| Range | Behaviour |
|---|---|
| `< 768px` (base) | Stitch design, verbatim |
| `md` 768–1023px | Bottom nav → top nav; carousels → grids; content max-width |
| `lg` ≥ 1024px | Wider grids; map sheet → persistent side panel |

Adaptation rules, so desktop stays a translation rather than a redesign:
- A carousel becomes a grid of the same card at the same aspect ratio.
- The bottom sheet becomes a right-hand panel with identical internal layout.
- Type scale is unchanged — `display-lg` stays 36px.
- Spacing steps are unchanged; only column counts and max-widths change.
- No component gains a desktop-only variant without approval.

---

## 4. Colour usage

| Intent | Token |
|---|---|
| Primary action, active nav, headings | `primary` navy |
| Links, "See All", check icons | `secondary` teal |
| Ratings, highlights | `tertiary` gold |
| Category tiles, tag pills, empty-state tiles | `cream` |
| Body text | `on-surface` |
| Secondary text, captions | `on-surface-variant` |
| Hairlines | `outline-variant` at 10–30% |

Gold is reserved for ratings and highlight accents. Teal is never a fill for a primary
button. Cream is a surface, never text.

**Gradient scrims** on `DestinationCard`, `CollectionCard`, and `FeatureCard`:
bottom-anchored black gradient, sufficient to keep white text at ≥ 4.5:1 over the
photograph. This is a contrast requirement, not a stylistic one.

---

## 5. Iconography

- **Material Symbols Outlined** — the Stitch source's icon font, and the reference for
  every icon shape in the design.
- **Lucide** — approved in the stack, used only where a Material Symbol has no equivalent.

Do not mix the two within a single row or component. Icons inside icon-only controls are
24px within a 48dp target. Decorative icons are `aria-hidden`; meaningful ones get an
accessible name on the control, not the glyph.

---

## 6. Imagery

- All imagery via `next/image` with explicit dimensions; the media host is registered in
  `remotePatterns`.
- **Real `alt` on every image.** Stitch's `data-alt` attribute is not carried over — it is
  invisible to screen readers and is the audit's highest-severity finding.
- `cover_image_url` is nullable: every card and hero needs a defined placeholder — a cream
  surface with the venue's category icon, never a broken image or a grey box.
- Aspect ratios are fixed per component (`h-64` destination, `h-40` collection,
  `aspect-[4/5]` feature, `h-80` detail hero) so cards never shift on load.

---

## 7. Interaction states

Every interactive element defines all five:

| State | Treatment |
|---|---|
| Default | — |
| Hover | `hover-scale` on card imagery only; subtle bg shift on rows and chips |
| Focus | Visible ring, `ring-2 ring-primary/20`. Never removed. |
| Active | `tap-scale` 0.90–0.95, 100–150ms |
| Disabled | Reduced opacity, `cursor-not-allowed`, `aria-disabled` |

Motion arrives in Phase 10 and must respect `prefers-reduced-motion`, under which
`tap-scale` and `hover-scale` are suppressed and the location-dot pulse becomes static.

---

## 8. Data states

Every data-backed region defines four. There are no exceptions, and no region ships with
only the happy path.

| State | Treatment |
|---|---|
| Loading | `Skeleton` matched to the real component's dimensions — never a spinner in place of a layout |
| Loaded | — |
| Empty | `EmptyState`. `/public/*` returning `[]` before a first publish is an empty state, not an error. |
| Error | `error.tsx` boundary with retry |

Partial data is normal, not exceptional: `rating`, `coordinates`, `cover_image_url`, and
`short_description` are all nullable, and every component must render correctly without
them. This is what makes the gaps in `API_REQUIREMENTS.md` non-blocking for component work.

---

## 9. Content rules

- Copy comes from the Studio API or the Stitch specification. Components never hardcode
  venue-facing strings.
- Static UI strings live in one module, so a future Arabic locale is a translation task
  rather than a refactor.
- Arabic content uses IBM Plex Sans Arabic with `dir="rtl"` on the element. Full RTL
  layout mirroring is **out of scope for v1** — only the Splash tagline is Arabic today.
- Truncation is explicit per component (card titles one line, descriptions two), never
  incidental overflow.

---

## 10. Component API conventions

- Variants are a `variant` prop on one component — never separate components. This is the
  rule that keeps `VenueCard` from becoming three files.
- Presentational components (Layers 1–2) take primitives and never import API or domain
  types.
- Composite components (Layer 3) take domain objects — `venue: Venue`, not
  `venue: PublishedVenue`.
- No component fetches data. Data enters through pages and TanStack Query hooks.
- Every icon-only control requires a `label` prop. It is not optional, so an unlabelled
  icon button cannot compile.
- No component renders `BottomNav` or `TopAppBar` — layouts do.

---

## 11. Unimplemented features stay visible

**A visual element present in Stitch is never removed because its functionality is not
built yet.** Disable the interaction; keep the element.

This applies to the avatar, the greeting, and the notification bell — all of which need
accounts or a notification system that v1 does not have. They render exactly as designed;
they simply do nothing.

| Element | v1 treatment |
|---|---|
| Avatar | Rendered at full size and styling, with a neutral placeholder in place of a user photo |
| Greeting ("Good Morning 👋") | Rendered verbatim, static — no time-of-day logic is inferred |
| Notification bell | Rendered in position, `disabled` + `aria-disabled`, no hover/active affordance |

Disabled controls keep their Stitch appearance rather than taking the dimmed
`disabled:opacity-50` treatment used for genuinely disabled actions — the goal is visual
fidelity, so they must not *look* broken. They are removed from the tab order and named
for screen readers as unavailable.

The alternative — deleting them — would silently redesign the header and make the
implementation impossible to diff against the export.

---

## 12. Known deviations from Stitch

Deliberate, approved, and recorded so they are never mistaken for drift:

| Deviation | Reason |
|---|---|
| Literal hex instead of theme aliases | Token drift across **all** exported screens — Home and Explore disagree with each other (`STITCH_SOURCE.md`) |
| Section headers 18/700, nav labels 12/500 | Export markup, correcting the handoff's stated scale |
| Cards `rounded-3xl` (24px) | Export markup, correcting `DESIGN.md`'s "16–20px" |
| Page `#F9F9FE`, cards `#FFFFFF` | Export markup; the handoff flattened both to white |
| Venue Details `px-4`, not `px-5` | Off-grid in Stitch; recorded as known debt |
| No bottom nav on Venue Details | Approved decision 6 |
| Icon controls 48dp everywhere | Stitch has 40px instances that fail WCAG 2.5.5 |
| Real `alt` instead of `data-alt` | Audit §7, highest severity |
| No `navigator.vibrate()` | Present on Explore only; unreplicated elsewhere |
| Real Mapbox surface | Stitch's map is a static illustration |
| Desktop layouts | No desktop screens exist in Stitch; approved decision 2 |

Anything not on this list is a bug, not a choice.
