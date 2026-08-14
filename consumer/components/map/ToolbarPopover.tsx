"use client";

/** Remove All Map BottomSheets task — the shared chrome every Map toolbar
 * popover (Destinations, Categories, Filters) is built from: same
 * background/border/radius/shadow/spacing/animation/positioning/
 * outside-click/Escape behavior, so the three read as one system with
 * different content rather than three separately-invented panels.
 * Extracted from `FilterPopover` (the first of the three built), not a
 * new design — `FilterPopover` now consumes this instead of keeping its
 * own private copy of the same chrome. */

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";
import type { ReactNode, Ref } from "react";
import { Icon } from "@/components/ui/Icon";

/** Small (28px) header control — the popover's own back/close, not the
 * app-wide `IconButton` (mandatory 48×48 hit area, sized for primary
 * screen-level actions). Every popover is a dense, secondary floating
 * surface with two larger alternative dismissals already available
 * (outside click, Escape), so a smaller-but-still-labelled control here
 * is the right trade for keeping every row/header compact. */
export function PopoverHeaderButton({
  icon,
  label,
  onClick,
}: {
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
      onClick={onClick}
      type="button"
    >
      <Icon name={icon} size={16} />
    </button>
  );
}

/** One selectable row — compact, optional leading icon, trailing check
 * indicator when active. Used for single-select (Destinations) and
 * multi-select (Categories, Filters' own tag/access rows) alike — the
 * check mark communicates "this is on," not "this is the only one." */
export function PopoverOptionRow({
  active,
  icon,
  label,
  onClick,
  rowRef,
}: {
  active: boolean;
  icon?: string;
  label: string;
  onClick: () => void;
  /** Only `DestinationPopover` sets this — the active row's own ref, so
   * it can `scrollIntoView` it when the popover opens. Every other
   * caller leaves it unset. */
  rowRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      aria-pressed={active}
      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
      onClick={onClick}
      ref={rowRef}
      type="button"
    >
      {icon ? <Icon className="text-on-surface-variant" name={icon} size={16} /> : null}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {active ? <Icon className="text-primary" name="check" size={16} /> : null}
    </button>
  );
}

type ToolbarPopoverProps = {
  open: boolean;
  onClose: () => void;
  /** Header title, e.g. "Destinations", "Categories", "Filters" — also the
   * default accessible name for the panel itself. */
  title: string;
  /** Present only when this panel has a list to return to (Filters'
   * category drill-down); omitted renders no back arrow. */
  onBack?: () => void;
  backLabel?: string;
  closeLabel?: string;
  /** Tailwind width class — Destinations/Categories run slightly wider
   * than Filters to fit real destination/category names without
   * truncating every row. */
  width?: string;
  /** Tailwind max-height class for the scrollable body — Destinations'
   * longer list is deliberately capped to ~3 rows (own scroll), Filters'
   * usual 1-2 rows never needs it. */
  maxHeightClass?: string;
  /** Ref onto the scrollable body — Destinations uses this to
   * `scrollIntoView` the active row on open; every other popover ignores
   * it. */
  listRef?: Ref<HTMLDivElement>;
  children: ReactNode;
};

/** The shared floating-panel shell every Map toolbar popover renders
 * inside — anchored under the toolbar (never from the bottom, never a
 * `BottomSheet`), dismissed by outside click or Escape, selections left
 * untouched by closing. Positioning is deliberately simple (fixed
 * `top-[76px] right-4`, not a full anchor-to-trigger measurement) because
 * the toolbar is pinned to the top of a full-bleed map — there's always
 * room below it, so a real collision-avoiding positioning primitive
 * would solve a problem this layout doesn't have. */
export function ToolbarPopover({
  open,
  onClose,
  title,
  onBack,
  backLabel = "Back",
  closeLabel,
  width = "w-56",
  maxHeightClass = "max-h-[240px]",
  listRef,
  children,
}: ToolbarPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) onClose();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    // `mousedown`, not `click` — matches the outside-tap-to-deselect
    // pattern `MapView`'s own background click handler uses, and fires
    // before the toolbar trigger's own click could immediately reopen it.
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          animate={{ opacity: 1, scale: 1, y: 0 }}
          aria-label={title}
          className={`absolute top-[76px] right-4 z-30 ${width} max-w-[calc(100vw-2rem)] origin-top-right overflow-hidden rounded-xl border border-outline-variant/20 bg-surface-container-lowest shadow-[var(--shadow-sheet)]`}
          exit={{ opacity: 0, scale: 0.96, y: -4 }}
          initial={{ opacity: 0, scale: 0.96, y: -4 }}
          ref={panelRef}
          role="dialog"
          transition={shouldReduceMotion ? { duration: 0 } : { type: "tween", duration: 0.16, ease: "easeOut" }}
        >
          {/* Header sits outside the scroll container — a long option list
            * (Destinations) must scroll on its own, never taking the
            * title/close row along with it. */}
          <div className="flex items-center gap-0.5 border-b border-outline-variant/15 px-1.5 py-1">
            {onBack ? <PopoverHeaderButton icon="arrow_back" label={backLabel} onClick={onBack} /> : null}
            <h3 className="flex-1 truncate px-1.5 text-xs font-bold text-primary">{title}</h3>
            <PopoverHeaderButton
              icon="close"
              label={closeLabel ?? `Close ${title.toLowerCase()}`}
              onClick={onClose}
            />
          </div>
          <div className={`${maxHeightClass} overflow-y-auto`} ref={listRef}>
            <div className="space-y-0.5 p-1.5">{children}</div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
