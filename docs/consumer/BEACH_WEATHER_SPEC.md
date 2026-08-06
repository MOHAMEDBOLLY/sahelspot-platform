# SahelSpot Mobile 2027 — Beach Weather Feature Specification

**Status: Planning only. Not implemented, not scheduled.** No screen, component, or API integration described here exists in the codebase yet. This document is the persisted record of that planning so it survives outside chat history — implementation begins only on explicit, separate approval, one piece at a time (Home Hero Widget first, full Beach Weather screen after).

This spec governs two related, but separately-approved, pieces of future work:

- **§1–9: the full Beach Weather screen** — not a generic weather screen; a beach-day decision tool for North Coast visitors.
- **§10: the Home Hero Weather Widget** — a small, separately-scoped teaser that lives in the Home Hero's reserved right-side slot (see `docs/consumer/MOBILE_2027_DESIGN_FREEZE.md` §10) and links into the full screen. Smaller in scope, approved for spec-only planning ahead of the full screen.

Nothing in this document authorizes implementation of either piece. Reuse-first discipline applies to both, per the rest of the frozen Mobile 2027 Design System.

---

## 1. Screen Purpose (Beach Weather screen)

Single question the screen exists to answer: **"Is today a good beach day?"** Every section either feeds that judgment directly (beach conditions, sea flag, UV) or supports the practical logistics of acting on it (best time to visit, hourly timeline, tips). Nothing is included solely because a generic weather app would have it.

## 2. Information Architecture

1. **Current Weather** — Temperature, Feels Like, Sky Condition, Wind, Humidity. Standard, lowest-risk section.
2. **Beach Conditions** — the screen's actual differentiator. Swimming Score, Sea Condition, Wave Height, Sea Temperature are MVP; Water Clarity and Jellyfish Risk are explicitly future (no source exists yet); Sea Flag Status (Green/Yellow/Red) is the single highest-value at-a-glance signal on the screen.
3. **Today's Timeline** — hourly forecast, scoped to daylight/beach-relevant hours, not a full 24h graph.
4. **7-Day Forecast** — standard trip-planning glance.
5. **UV & Safety** — UV Index plus a plain-language protection recommendation.
6. **Sunrise & Sunset** — supports "Best Sunset" in §7 directly.
7. **Best Time to Visit Today** — a *derived* section (best swim window, best sunset) computed from §1/§2/§6's data, not a new raw data source.
8. **Travel Tips** — short templated strings keyed off condition thresholds (e.g., wind > X → "Windy afternoon"), not free-text CMS content.

## 3. Component Reuse Plan

| Section | Reused Component | Notes |
|---|---|---|
| Screen shell | `TopAppBar` (`title` variant) | Push-shell screen, no bottom nav — same shape as Venue Details/Search |
| Sea Flag Status | `StatusBadge` extended with a 3-state variant, or `Pill` (`variant="tag"`) recolored per state | **Open decision** — StatusBadge is currently boolean (open/closed); needs an explicit call before build, not an ad-hoc one mid-implementation |
| Current Weather stats | `InfoPill` ×4 (Temp/Feels-Like/Wind/Humidity) | Matches Venue Details' existing horizontal info-pill row exactly |
| Beach Conditions stats | `InfoPill` (Wave Height/Sea Temp), `StatTile` for Swimming Score if bigger emphasis is needed | `StatTile` already exists for Map's bottom-sheet stats — correct reuse candidate |
| Today's Timeline | `CardCarousel` wrapping one small new per-hour cell | The one place a small new leaf component is legitimately needed — built from `Icon` + text, no new visual language |
| 7-Day Forecast | `ListRowItem` repurposed (icon/label/trailing-value shape → day/icon/high-low) | Strong reuse candidate |
| UV & Safety | `InfoPill` + plain text recommendation | No new component |
| Sunrise/Sunset | `InfoPill` ×2 | No new component |
| Best Time to Visit | `SectionHeader` + `InfoPill` ×2 | No new component |
| Travel Tips | `ChecklistRow` (same shape as Venue Details' "Why visit?") | No new component |
| Loading | `Skeleton` | No new component |
| Empty/Error/Offline | `EmptyState` | No new component |

**Net new components required: at most one** (the hourly timeline cell) — confirm even that isn't reducible to an existing primitive once real API field shapes are known.

## 4. Navigation Flow

- **Entry points (future):** Home Hero Widget (§10) → full screen; Destination Details → weather summary row/CTA → full screen; Venue/Beach pages → similar; Search → not a primary entry point.
- **Screen itself:** single scroll, push-shell, no internal tabs — same shape as Venue Details.
- **Scope selector (open question):** per-destination vs. regional weather. The IA implies a single location ("Best swimming: 09:00–11:00" is location-specific). Likely `/weather?destination={id}`, mirroring Search's own `?destination=` param — not decided here, flagged for a decision before API/URL design.

## 5. State Management

- Server state via a new `useWeather(destinationId)` hook, same TanStack Query pattern as `useVenues`/`useDestinations`/`useEvents` — no new state-management approach.
- No device-local persistence needed unless a "preferred destination" concept is introduced later.
- Weather is time-sensitive (unlike venue/destination data) — needs a deliberately short `staleTime`/refetch interval, a genuinely new consideration versus the app's other hooks.

## 6. Accessibility Considerations

- Sea Flag Status must never communicate state through color alone — needs a text label ("Safe to swim"/"Caution"/"Danger") alongside the color, same principle `StatusBadge` already follows for Open/Closed.
- Hourly timeline cells need real accessible labels (time + condition + temp), not just visually-adjacent icon+number pairs.
- This is a fetch-once-per-visit screen, not a live ticker — `aria-live` should not be over-applied to sections that only update on navigation, not in place.

## 7. Risks

1. No weather API/data provider has been named — nothing here should be scheduled until one is chosen, including its cost/rate-limit profile for an unbounded-traffic public site.
2. The 3-state Sea Flag status has no existing component — needs an explicit design decision before implementation (same class of decision as the FilterChip/StatusBadge resolution already made once this migration).
3. "Best Time to Visit" is derived, not raw data — must be one clearly-owned utility function (mirroring `lib/domain/formatOpenUntil.ts`'s pattern), not inline per-screen logic, to avoid becoming an undocumented second business-logic layer.
4. Destination-specific vs. regional scope is unresolved and blocks URL/API design (§4).
5. Home Hero Widget integration (§10) depends on the Hero's reserved layout slot (Design Freeze §10) — that dependency is now real, not hypothetical, but the widget's *content* is scoped separately (see §10 below) from the full screen's scope.

## 8. API Requirements

**Required for MVP:**
- Current temperature, feels-like, sky condition (enum), wind speed, humidity
- Sea/water temperature, wave height, a computed or provided swimming score, Sea Flag status (Green/Yellow/Red enum)
- Hourly forecast (temp + sky condition) for same-day remaining hours
- 7-day forecast (high/low temp + sky condition per day)
- UV index (numeric) + a mappable protection-level tier
- Sunrise/sunset timestamps

**Explicitly future:**
- Water Clarity
- Jellyfish Risk
- Historical/trend data beyond 7 days

**Undecided, blocks final MVP scoping:**
- Who computes Sea Flag status / Swimming Score — a third-party marine API field directly, or a SahelSpot-side formula over raw wave/wind/current data. Materially changes the API contract.
- Per-destination vs. per-region granularity (ties to §4).

## 9. Future Roadmap (full screen, out of MVP)

- Destination Details / Beach pages / Event pages weather integration — likely a compact summary row + link to the full screen, not the full 8-section IA embedded inline.
- Water Clarity, Jellyfish Risk.
- Push notifications / "good beach day today" alerts — not requested; noted only as a natural extension a stakeholder may ask about later.

---

## 10. Home Hero Weather Widget

**Status: Planning only. Spec approved for documentation; implementation not started, not scheduled.**

This is a **separate, smaller-scoped piece** from the full Beach Weather screen above — a minimal teaser, not a preview of the full screen's data.

### Purpose

A quick "today at a glance" summary in the Home Hero's reserved right-side slot (Design Freeze §10, reserved by the 2026-08-06 Home Polish pass), encouraging navigation into the future Beach Weather screen. It is a status indicator, not a weather report.

### Content — exactly two data points, nothing else

- Current Temperature (e.g., `31°C`)
- Beach Flag Status, shown as a colored indicator + short label (e.g., `🟢 Green Flag`, `🟡 Caution`)

### Explicitly excluded from this widget

Hourly forecast, wind, humidity, UV, waves, sea temperature, long text, forecast cards, weather graphs — all of that belongs only to the full Beach Weather screen (§1–2), never to this widget. If a future revision of this widget wants more content, that is a new decision, not an extension assumed by this spec.

### Layout

Occupies the Home Hero's reserved right-side slot (the `justify-between` row structured in the 2026-08-06 Home Polish pass — see `HomeClient.tsx`'s hero section and Design Freeze §10). Must read as a premium editorial status indicator — restrained typography and a small color/status mark — not as a weather-app widget. No card chrome, no icon-heavy weather-app styling; it should feel closer to a section header's quiet tick mark than to a dashboard tile.

### Interaction

The entire widget is a single tap target. Tap → navigates to the future Beach Weather screen (route TBD — see §4's open scope-selector question, since the widget's own destination-scoping depends on that same unresolved decision).

### Component reuse (planning-level, not final)

No new component is expected to be required: a temperature string, a small colored status mark, and a short label are all renderable with existing primitives (`Icon` or a plain colored dot + text, matching the restraint of `StatusBadge`'s existing text+color pattern for Sea Flag — see §3). Final component mapping is deferred to implementation-approval time, per the same discipline used for every other screen in this migration — no premature component design.

### Dependencies / blocking items before implementation can begin

1. Design Freeze §10's reserved Hero slot must remain reserved (already true — no other feature may claim it without a new decision).
2. The Sea Flag 3-state visual treatment (§3's open decision) must be resolved — the widget cannot ship a flag status without it, and this widget is actually the *first* place that decision becomes load-bearing, ahead of the full screen.
3. A weather API/provider must be chosen (§7 risk #1) — this widget has the exact same dependency as the full screen, just consuming a two-field subset of the same data.
4. The Beach Weather screen's own route must exist (or at minimum be defined) for the tap target to have a destination — the widget should not ship before the screen it links to is at least routable.

---

# Future Home Hero Weather Widget

**Status: Permanent product rule. Planning only — not implemented.**

This widget is intentionally minimal.

Its purpose is **NOT** to replace the Beach Weather screen.

Its purpose is to answer one question immediately: **"Is today a good beach day?"**

---

## Widget Content

Display **ONLY** two values:

1. **Current Temperature**
   Example: `31°C`

2. **Beach Flag Status**
   Possible states:
   - 🟢 Green Flag
   - 🟡 Caution
   - 🔴 Unsafe

Nothing else.

---

## Absolutely DO NOT include

- Hourly Forecast
- Wind Speed
- Humidity
- UV Index
- Wave Height
- Sea Temperature
- Water Quality
- Jellyfish Risk
- Forecast Cards
- Charts
- Animations
- Multiple rows of information
- Weather summaries
- Long descriptive text

---

## Interaction

The entire widget is tappable.

Tap → Beach Weather Screen.

The Home Hero never expands.

The Home Hero never becomes a mini weather application.

---

## Design Principles

The widget must feel like an editorial status indicator.

Not a dashboard.

Not a weather application.

It should occupy very little visual space.

The Home screen remains focused on discovering destinations.

The Weather screen remains the place for all detailed weather information.

---

## Future Placement

The widget occupies the reserved right-side area of the Home Hero established during the Mobile 2027 Home Polish.

That reserved area must not be reused for any unrelated feature.

---

## Relationship with Beach Weather

```
Home Hero
   ↓
Temperature
   ↓
Beach Flag
   ↓
Tap
   ↓
Beach Weather
```

Beach Weather contains:

- Current Conditions
- Beach Conditions
- Hourly Forecast
- 7-Day Forecast
- UV
- Sunrise / Sunset
- Best Time To Visit
- Travel Tips

---

This documentation establishes a permanent product rule. Any future implementation must follow this specification exactly.

---

*This document reflects planning state only, as of 2026-08-06. Any change to scope, content, or component mapping for either the full Beach Weather screen or the Home Hero Widget requires a revision of this document, not an inline decision made during implementation.*
