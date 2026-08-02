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

/** `solid` — Home, Search: `bg-surface-container-high`, filled navy filter
 * button attached to the right.
 * `glass` — Map: `bg-white/95 backdrop-blur-md`, floating over the map layer.
 *
 * Focus adds a ring to the *parent* pill, matching the export's own JS
 * listener that ring-highlights the whole control rather than the bare input
 * outline. */
const VARIANTS: Record<SearchFieldVariant, string> = {
  solid: "bg-surface-container-high",
  glass: "bg-white/95 backdrop-blur-md shadow-lg",
};

export function SearchField({
  variant = "solid",
  onFilterClick,
  filterLabel = "Open filters",
  className = "",
  ...props
}: SearchFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <div
      className={`relative flex h-14 items-center rounded-full transition-all ${
        VARIANTS[variant]
      } ${focused ? "ring-2 ring-primary" : ""} ${className}`}
    >
      <Icon className="pointer-events-none absolute left-4 text-outline" name="search" />
      <input
        // Solid on-surface-variant, not the export's /60 opacity: computed
        // contrast at 60% is 2.6:1 against this surface, well under WCAG's
        // 4.5:1 minimum for text. Full opacity measures 6.1:1.
        className="h-full w-full rounded-full bg-transparent pr-12 pl-12 placeholder:text-on-surface-variant focus:outline-none"
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
      {onFilterClick ? (
        // 48dp per the accessibility fix in IconButton — Stitch's own control
        // here is a 40px circle (`p-2.5`), one of the audit's sub-44dp
        // instances.
        <button
          aria-label={filterLabel}
          className="absolute right-1 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white transition-transform active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          onClick={onFilterClick}
          type="button"
        >
          <Icon name="tune" />
        </button>
      ) : null}
    </div>
  );
}
