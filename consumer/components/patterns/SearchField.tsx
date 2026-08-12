"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Icon } from "@/components/ui/Icon";

type SearchFieldVariant = "solid" | "glass";

type SearchFieldOwnProps = {
  variant?: SearchFieldVariant;
  /** Renders the attached filter button (Home, Search). Map's floating search
   * pairs with a separate FilterChip row instead, so it omits this. */
  onFilterClick?: () => void;
  filterLabel?: string;
};

type SearchFieldProps = SearchFieldOwnProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, keyof SearchFieldOwnProps | "type">;

/** The "Layered Dock Search" — the signature component of the frozen
 * SahelSpot Mobile 2027 Design System, treated with the same importance as
 * the card system (docs/consumer/MOBILE_2027_DESIGN_FREEZE.md §3.2). This is
 * a visual reconstruction, not a restyle: the search surface is now a white,
 * card-family-radius panel resting on a structural yellow base layer that
 * peeks out from beneath one edge — reading as a physically constructed
 * object, not a bordered input. No glassmorphism, no gradient, no iOS/
 * Material pill shape.
 *
 * `solid` and `glass` are kept as accepted prop values for API
 * compatibility with existing callers (Home/Search use `solid`, Map uses
 * `glass`), but both now render the identical Layered Dock surface — the
 * frozen system has exactly one search construction, not two. Retaining the
 * prop rather than removing it avoids a breaking API change; it is simply a
 * no-op distinction now.
 *
 * Focus behavior is unchanged from the original implementation: a JS-tracked
 * `focused` state ring-highlights the whole control rather than the bare
 * input outline, matching the export's own listener behavior — only the
 * ring's visual treatment changed, not the mechanism. */
export function SearchField({
  variant: _variant = "solid",
  onFilterClick,
  filterLabel = "Open filters",
  className = "",
  ...props
}: SearchFieldProps) {
  const [focused, setFocused] = useState(false);
  // `variant` is accepted for API compatibility but no longer changes the
  // rendered surface — see docstring.

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Structural yellow base layer — not a border, not a decoration: a
       * second surface sitting behind and slightly proud of the white panel,
       * so a sliver is visibly load-bearing beneath it. */}
      <div className="relative min-w-0 flex-1">
        <div aria-hidden="true" className="absolute inset-x-1 -bottom-1 h-14 rounded-3xl bg-accent" />
        <div
          className={`relative flex h-14 items-center rounded-3xl bg-surface-container-lowest shadow-md transition-shadow ${
            focused ? "ring-2 ring-primary/40" : ""
          }`}
        >
          <Icon className="pointer-events-none absolute left-4 text-primary" name="search" />
          <input
            // Solid on-surface-variant, not the export's /60 opacity: computed
            // contrast at 60% is 2.6:1 against this surface, well under WCAG's
            // 4.5:1 minimum for text. Full opacity measures 6.1:1.
            className="font-sans h-full w-full rounded-3xl bg-transparent pr-4 pl-12 placeholder:text-on-surface-variant focus:outline-none"
            onBlur={(event) => {
              setFocused(false);
              props.onBlur?.(event);
            }}
            onFocus={(event) => {
              setFocused(true);
              props.onFocus?.(event);
            }}
            type="text"
            {...props}
          />
        </div>
      </div>
      {onFilterClick ? (
        // A dedicated capsule, not an icon merged into the search pill — its
        // own filled-accent object, docked beside the search surface, same
        // shared corner radius as the rest of the card/search family. 48dp
        // touch target per the accessibility fix already in place.
        // Motion & Micro-Interactions Upgrade, item 2 — this is the closest
        // thing the Hero has to a "primary CTA" (no literal CTA button
        // exists in this design; the filter button is the one prominent
        // actionable element). Press: 1 -> 0.96 -> 1 with a quick ease-out
        // return, plus a soft lime glow ring that swaps in for the resting
        // `shadow-md` while pressed — the "optional soft lime glow during
        // interaction" the brief describes.
        <button
          aria-label={filterLabel}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-accent text-on-accent shadow-md transition-all duration-200 ease-out active:scale-[0.96] active:shadow-[0_0_0_6px_var(--color-accent-container)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          onClick={onFilterClick}
          type="button"
        >
          <Icon name="tune" />
        </button>
      ) : null}
    </div>
  );
}
