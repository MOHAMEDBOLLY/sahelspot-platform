"use client";

import { AnimatePresence, motion, useMotionValue, useReducedMotion } from "framer-motion";
import type { PanInfo } from "framer-motion";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { IconButton } from "@/components/ui/IconButton";

type BottomSheetProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

/** Distance (px) past which a release dismisses regardless of speed. */
const DISMISS_DISTANCE_PX = 96;
/** Downward speed (px/s) past which a release dismisses regardless of
 * distance — a quick flick should be enough, so a decisive short gesture
 * isn't punished for not travelling far. */
const DISMISS_VELOCITY = 520;

/** Map's bottom sheet — drag handle -> title/close row -> content slot.
 *
 * Slides up on open and down on close via Framer Motion — the one place a
 * real mount/exit transition adds something CSS alone can't do cleanly
 * (animating *out* a conditionally-rendered element). Respects
 * `prefers-reduced-motion` through Framer's own `useReducedMotion`, on top
 * of (not instead of) the blanket CSS override in globals.css.
 *
 * Takes `open` rather than being conditionally rendered by its parent — a
 * caller keeps passing the same `title`/`children` through the close
 * transition so the sheet has real content to slide away with instead of
 * going blank first.
 *
 * COASTAL EDITORIAL MIGRATION — drag-to-dismiss. The handle at the top has
 * always *implied* a physical gesture while being decorative; this makes
 * that gesture real, which was the highest-value remaining tactility gap
 * the Visual Vitality audit identified.
 *
 * Behavior, following the momentum rules in the project's motion guidance:
 * a release dismisses if it travelled past `DISMISS_DISTANCE_PX` OR if it
 * was moving faster than `DISMISS_VELOCITY` downward, so a short flick and
 * a long slow drag both work. Anything else springs back to rest.
 * `dragConstraints`/`dragElastic` allow a little resistance upward rather
 * than a hard wall (things in the real world slow before they stop), and
 * `dragMomentum={false}` keeps the sheet from coasting on its own after
 * release — the spring, not inertia, decides where it lands. Framer's drag
 * gesture is interruptible by nature: grabbing the sheet mid-spring
 * retargets from wherever it currently is instead of restarting.
 *
 * `dragListener` is disabled entirely under reduced motion, leaving the
 * close button and Escape as the dismissal paths — a drag whose whole
 * feedback channel is movement has nothing to express once movement is
 * suppressed.
 *
 * NOTE ON CALL SITES: this component currently has none. The Map moved its
 * three toolbar panels to `ToolbarPopover` in the "Remove All Map
 * BottomSheets" task, so nothing in the app renders a `BottomSheet` today.
 * The gesture is implemented here and ready, and deliberately not wired
 * back into the Map — doing that would revert a separate, deliberate
 * production decision that is out of this task's scope. */
export function BottomSheet({ open, title, onClose, children }: BottomSheetProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const y = useMotionValue(0);

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // Every open starts from rest: without this a sheet dismissed by drag
  // would re-open still carrying the offset it was released at.
  useEffect(() => {
    if (open) y.set(0);
  }, [open, y]);

  function onDragEnd(_event: unknown, info: PanInfo) {
    const draggedFarEnough = info.offset.y > DISMISS_DISTANCE_PX;
    const flickedFastEnough = info.velocity.y > DISMISS_VELOCITY;
    if (draggedFarEnough || flickedFastEnough) {
      onClose();
      return;
    }
    // Not decisive enough — spring back to rest rather than snapping.
    y.set(info.offset.y);
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          animate={{ y: 0 }}
          aria-label={title}
          className="absolute inset-x-0 bottom-0 z-30 max-h-[70%] overflow-y-auto rounded-t-3xl bg-surface-container-lowest shadow-[var(--shadow-sheet)]"
          drag={shouldReduceMotion ? false : "y"}
          // Downward only has no cap (the release handler decides the
          // outcome); upward is clamped to 0 with a little give.
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0.04, bottom: 0.9 }}
          dragMomentum={false}
          exit={{ y: "100%" }}
          initial={{ y: "100%" }}
          onDragEnd={onDragEnd}
          role="dialog"
          style={{ y }}
          transition={
            shouldReduceMotion ? { duration: 0 } : { type: "spring", damping: 32, stiffness: 320 }
          }
        >
          {/* `touch-none` on the handle keeps a vertical drag that starts
            * here from being claimed by the sheet's own `overflow-y-auto`
            * scrolling. The body below stays normally scrollable. */}
          <div className="flex touch-none justify-center pt-3">
            <span aria-hidden="true" className="h-1 w-10 rounded-full bg-outline-variant/40" />
          </div>
          <div className="flex items-center justify-between px-4 pt-2">
            <h2 className="text-xl font-bold text-primary">{title}</h2>
            <IconButton
              icon="close"
              label="Close"
              onClick={onClose}
              ref={closeButtonRef}
              variant="plain"
            />
          </div>
          <div className="space-y-4 p-4">{children}</div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
