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

/** Search bar — Home UI Refinement pass. A single flat rounded panel (no
 * layered accent-color base peeking out from beneath), compact and elegant
 * per the brief rather than a construction-heavy "signature" object. Still
 * one shared component across Home/Search/Map, still card-family radius and
 * a hairline border so it reads as part of the same surface language as the
 * rest of the app.
 *
 * `variant` is kept for API compatibility with existing callers (Home/Search
 * use `solid`, Map uses `glass`) but is now a no-op — one search construction,
 * not two. */
export function SearchField({
  variant: _variant = "solid",
  onFilterClick,
  filterLabel = "Open filters",
  className = "",
  ...props
}: SearchFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        // Focus ring is ochre, not the structural charcoal every other
        // control's `ring-primary` uses — COLOR SYSTEM V2 §10: Search is
        // the one place the spec calls for the sparser secondary accent
        // rather than the primary structural dark, so its focus state
        // reads as a distinct, deliberate accent rather than "the same
        // dark ring everything else gets."
        className={`relative flex h-12 flex-1 items-center rounded-2xl border border-outline-variant/20 bg-surface-container-lowest shadow-sm transition-shadow ${
          focused ? "ring-2 ring-ochre/40" : ""
        }`}
      >
        <Icon className="pointer-events-none absolute left-4 text-on-surface-variant" name="search" size={20} />
        <input
          className="font-sans h-full w-full rounded-2xl bg-transparent pr-4 pl-11 text-sm placeholder:text-on-surface-variant focus:outline-none"
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
      {onFilterClick ? (
        <button
          aria-label={filterLabel}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-outline-variant/20 bg-surface-container-lowest text-primary shadow-sm transition-all duration-200 ease-out active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          onClick={onFilterClick}
          type="button"
        >
          <Icon name="tune" size={20} />
        </button>
      ) : null}
    </div>
  );
}
