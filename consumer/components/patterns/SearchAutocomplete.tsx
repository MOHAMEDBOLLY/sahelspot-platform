"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { SearchField } from "@/components/patterns/SearchField";
import { buildSearchOptions, SearchSuggestions, type SearchOption } from "@/components/patterns/SearchSuggestions";
import { useSearchSuggestions } from "@/lib/hooks/useSearchSuggestions";
import type { Venue } from "@/lib/domain/venue";

const EASE = [0.16, 1, 0.3, 1] as const;

type SearchAutocompleteProps = {
  value: string;
  onChange: (value: string) => void;
  /** Enter with no suggestion highlighted — the existing raw-search
   * submission (`SearchClient`'s `runSearch`, `HomeClient`'s `goToSearch`).
   * Never bypassed: this is what keeps the full Search page's own behavior
   * intact per the audit's §22 constraint. */
  onSubmit: (query: string) => void;
  onSelectVenue: (venue: Venue) => void;
  onSelectDestination: (destinationId: string, name: string) => void;
  onSelectCategory: (value: string) => void;
  /** Defaults to `onSubmit` — selecting a recent search re-runs it exactly
   * like typing it and pressing Enter, matching the audit's verified
   * `/search?q={term}` contract. Callers on `/search` itself override this
   * to update local state directly instead of navigating. */
  onSelectRecent?: (term: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  onFilterClick?: () => void;
  className?: string;
  /** Fires whenever the dropdown's own visibility changes. `SearchClient`
   * uses this to hide its page-level "Recent Searches" section while the
   * dropdown is showing the same list over it — the one cosmetic
   * duplication flagged after the initial P0/P1 pass. Optional: Home has no
   * equivalent page-level section, so it simply doesn't pass this. */
  onSurfaceOpenChange?: (open: boolean) => void;
} & Pick<ComponentProps<typeof SearchField>, "variant">;

/** Search Autocomplete P0/P1 — the one dropdown component used by both Home's
 * hero search and the Search page's own field (audit §7/§9). Composes
 * `SearchField` (unchanged) with `useSearchSuggestions` and owns the
 * combobox keyboard/ARIA contract (audit §12) so neither caller has to
 * reimplement it.
 *
 * Desktop (audit §14): inline dropdown directly beneath the field, the
 * existing rounded-panel/hairline-border language `SearchField` already
 * uses — no command palette, no overlay.
 * Mobile (audit §13): same construction; `max-h-[60vh] overflow-y-auto` on
 * the listbox (see `SearchSuggestions`) keeps it usable above an open
 * keyboard on 390×844 without a fixed height that could fall below the fold. */
export function SearchAutocomplete({
  value,
  onChange,
  onSubmit,
  onSelectVenue,
  onSelectDestination,
  onSelectCategory,
  onSelectRecent,
  placeholder,
  autoFocus,
  onFilterClick,
  className,
  variant,
  onSurfaceOpenChange,
}: SearchAutocompleteProps) {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listboxId = useId();
  const anchorRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [anchorRect, setAnchorRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const suggestions = useSearchSuggestions(value);
  const selectRecent = onSelectRecent ?? onSubmit;

  const options = useMemo<SearchOption[]>(
    () =>
      buildSearchOptions({
        isActive: suggestions.isActive,
        recentSearches: suggestions.recentSearches,
        destinations: suggestions.destinations,
        categories: suggestions.categories,
        venues: suggestions.venues,
      }),
    [suggestions.isActive, suggestions.recentSearches, suggestions.destinations, suggestions.categories, suggestions.venues],
  );

  const activeOption = activeIndex >= 0 ? options[activeIndex] : undefined;
  const showSurface = open && (suggestions.isActive || options.length > 0 || suggestions.isLoading);

  useEffect(() => {
    onSurfaceOpenChange?.(showSurface);
  }, [showSurface, onSurfaceOpenChange]);

  // Rendered through a portal (below) rather than absolutely inside this
  // component's own DOM position — `SearchAutocomplete` is used inside
  // Home's hero band, which sits under an `overflow-hidden` ancestor
  // (`HomeClient`'s hero/backdrop wrapper, load-bearing there for clipping
  // the background's breathing scale animation). An `absolute` dropdown
  // would be clipped by that ancestor before it ever reached the screen, so
  // position is computed from the field's own bounding rect and the surface
  // is portaled to `document.body` instead — works identically on Search's
  // page (no clipping ancestor) since the math is the same either way.
  useLayoutEffect(() => {
    if (!showSurface || !anchorRef.current) return;
    const update = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (rect) setAnchorRect({ top: rect.bottom + 8, left: rect.left, width: rect.width });
    };
    update();
  }, [showSurface]);

  // A stale floating position is worse than a closed dropdown — closing on
  // scroll (page-level scroll, not the listbox's own internal
  // `overflow-y-auto`) is the simplest correct behavior rather than
  // recomputing position on every scroll frame.
  useEffect(() => {
    if (!showSurface) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, { capture: true, passive: true });
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
    };
  }, [showSurface]);

  // Outside-tap dismissal (audit §13/§8) — a real `mousedown`-outside
  // listener rather than the input's own `onBlur`. `onBlur` fires as soon as
  // a suggestion row *steals* focus by being clicked (buttons are focusable
  // by default), which would close the surface — and clear `options` — a
  // tick before the row's own `onClick` selection handler runs, racing the
  // two. Listening on `document` and checking containment against both the
  // field and the portaled dropdown sidesteps that race entirely: a tap on
  // an option is "inside" and never closes the surface pre-emptively; a tap
  // anywhere else closes it, matching "outside tap should dismiss".
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
      setActiveIndex(-1);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  function selectOption(option: SearchOption) {
    if (option.kind === "recent") selectRecent(option.term);
    else if (option.kind === "destination") onSelectDestination(option.destinationId, option.name);
    else if (option.kind === "category") onSelectCategory(option.value);
    else onSelectVenue(option.venue);
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      if (options.length === 0) return;
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => (current + 1 >= options.length ? 0 : current + 1));
      return;
    }
    if (event.key === "ArrowUp") {
      if (options.length === 0) return;
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => (current - 1 < 0 ? options.length - 1 : current - 1));
      return;
    }
    if (event.key === "Enter") {
      if (activeOption) {
        event.preventDefault();
        selectOption(activeOption);
        return;
      }
      // No active suggestion — existing raw-search submission, untouched.
      setOpen(false);
      setActiveIndex(-1);
      onSubmit(value);
      return;
    }
    if (event.key === "Escape") {
      // Close the surface, keep the typed text — audit §12.
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (event.key === "Tab") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div className={`relative ${className ?? ""}`} ref={anchorRef}>
      <SearchField
        aria-activedescendant={activeOption?.id}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={showSurface}
        autoFocus={autoFocus}
        onChange={(event) => {
          onChange(event.target.value);
          setActiveIndex(-1);
          // Typing again after Escape (which closes the surface but keeps
          // focus on the input) should resume showing suggestions rather
          // than requiring an extra blur+refocus.
          setOpen(true);
        }}
        onFilterClick={onFilterClick}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        role="combobox"
        value={value}
        variant={variant}
      />

      {typeof document !== "undefined" && showSurface && anchorRect
        ? createPortal(
            <AnimatePresence>
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="fixed z-30 overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface-container-lowest shadow-lg"
                exit={{ opacity: 0 }}
                initial={reduceMotion ? false : { opacity: 0, y: -6 }}
                ref={dropdownRef}
                style={{ top: anchorRect.top, left: anchorRect.left, width: anchorRect.width }}
                transition={{ duration: reduceMotion ? 0 : 0.15, ease: EASE }}
              >
                <SearchSuggestions
                  activeOptionId={activeOption?.id ?? null}
                  isActive={suggestions.isActive}
                  isEmpty={suggestions.isEmpty}
                  isError={suggestions.isError}
                  isLoading={suggestions.isLoading}
                  listboxId={listboxId}
                  onClearRecent={suggestions.clearRecentSearches}
                  onRetry={suggestions.refetch}
                  onSelectCategory={onSelectCategory}
                  onSelectDestination={onSelectDestination}
                  onSelectRecent={selectRecent}
                  onSelectVenue={onSelectVenue}
                  options={options}
                />
              </motion.div>
            </AnimatePresence>,
            document.body,
          )
        : null}
    </div>
  );
}
