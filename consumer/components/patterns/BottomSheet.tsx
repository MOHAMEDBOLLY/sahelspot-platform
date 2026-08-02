"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { IconButton } from "@/components/ui/IconButton";

type BottomSheetProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

/** Map's bottom sheet — drag-handle (visual only, matching Stitch: no real
 * sheet physics there either) → title/close row → content slot.
 *
 * Slides up on open and down on close via Framer Motion — the one place in
 * Phase 10 a real mount/exit transition adds something CSS alone can't do
 * cleanly (animating *out* a conditionally-rendered element). Respects
 * `prefers-reduced-motion` through Framer's own `useReducedMotion`, on top
 * of (not instead of) the blanket CSS override in globals.css.
 *
 * Takes `open` rather than being conditionally rendered by its parent — the
 * parent keeps passing the same `title`/`children` through the close
 * transition (see the Map page, which stops updating `selectedDestinationId`
 * on close rather than nulling it immediately) so the sheet has real content
 * to slide away with instead of going blank first.
 *
 * Closes on Escape and moves focus to the close button on open, since this
 * is the first component in the library with real overlay semantics. */
export function BottomSheet({ open, title, onClose, children }: BottomSheetProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          animate={{ y: 0 }}
          aria-label={title}
          className="absolute inset-x-0 bottom-0 z-30 max-h-[70%] overflow-y-auto rounded-t-3xl bg-surface-container-lowest shadow-[var(--shadow-sheet)]"
          exit={{ y: "100%" }}
          initial={{ y: "100%" }}
          role="dialog"
          transition={
            shouldReduceMotion ? { duration: 0 } : { type: "spring", damping: 32, stiffness: 320 }
          }
        >
          <div className="flex justify-center pt-3">
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
