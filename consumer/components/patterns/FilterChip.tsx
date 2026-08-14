"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ComponentPropsWithoutRef } from "react";
import { Icon } from "@/components/ui/Icon";

type FilterChipOwnProps = {
  label: string;
  icon?: string;
  active?: boolean;
  /** Adaptive Map Toolbar — when `false`, renders icon-only (Map's idle
   * toolbar state); when `true` (default, every pre-existing caller),
   * renders icon+label exactly as before. `label` is always the
   * accessible name regardless — collapsing is a visual-only change, an
   * icon-only chip is never less discoverable to assistive tech than an
   * expanded one. The width change between the two animates via Framer
   * Motion `layout` (already a dependency, see `BottomSheet`/
   * `DestinationCoverflow`), not a manual width/opacity keyframe. */
  expanded?: boolean;
  /** A numeric count rendered as its own small pill, visually separate
   * from `label` — Map's Filters control uses this for "N contextual
   * filters active" (Adaptive Map Toolbar task). Approved presentation is
   * this separate pill; never concatenated into `label` text like
   * `"Filters 2"` or `"Filters • 2"` — both were evaluated and rejected
   * in the isolated prototype as less scannable than a distinct badge. */
  badge?: number;
};

// `motion.button`'s event-handler types (`onAnimationStart`, etc.) don't
// match plain `ButtonHTMLAttributes` — every existing caller only ever
// passes `onClick`, so widening against `motion.button`'s own prop type
// (rather than the DOM one) is what actually type-checks here, with no
// behavior change for callers.
type FilterChipProps = FilterChipOwnProps &
  Omit<ComponentPropsWithoutRef<typeof motion.button>, keyof FilterChipOwnProps>;

/** Pill filter — the Map category row ("All", "Beaches", "Food", ...) and
 * Search's category/status row. Active = navy fill with accent-yellow text
 * (docs/consumer/MOBILE_2027_COMPONENT_MAPPING.md §4 — yellow is the frozen
 * system's single accent, not white, on the active state); inactive =
 * bordered white, matching the export's `interactive_map_1` chip row. */
export function FilterChip({
  label,
  icon,
  active = false,
  expanded = true,
  badge,
  className = "",
  ...props
}: FilterChipProps) {
  const accessibleName = badge ? `${label}, ${badge} active` : label;

  return (
    <motion.button
      aria-label={accessibleName}
      aria-pressed={active}
      layout
      // Motion & Micro-Interactions Upgrade, item 4 — a short (200ms)
      // `transition-all` so the navy fill fades in rather than snapping,
      // plus a small `scale-[1.02]` only while active: a resting-state
      // "this is selected" cue, distinct from the family's press-scale
      // (which still applies underneath via `active:` on tap, same as
      // every other tappable chip/card). `layout`'s own transition below
      // only governs the icon-only <-> icon+label width change — a
      // separate, deliberately non-bouncy tween (Adaptive Map Toolbar
      // prototype's validated values), not the color/scale fade above.
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 ${
        active
          ? "scale-[1.02] bg-primary text-accent"
          : "border border-outline-variant/30 bg-white text-on-surface"
      } ${className}`}
      transition={{ type: "tween", duration: 0.18, ease: "easeOut" }}
      type="button"
      {...props}
    >
      {icon ? <Icon size={17} name={icon} /> : null}
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.span
            animate={{ opacity: 1 }}
            className="overflow-hidden whitespace-nowrap"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            key="label"
            transition={{ duration: 0.12 }}
          >
            {label}
          </motion.span>
        ) : null}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {badge ? (
          <motion.span
            animate={{ opacity: 1 }}
            className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-bold ${
              active ? "bg-accent text-primary" : "bg-primary text-accent"
            }`}
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            key="badge"
            transition={{ duration: 0.12 }}
          >
            {badge}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </motion.button>
  );
}
