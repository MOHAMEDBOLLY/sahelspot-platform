"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { IconButton } from "@/components/ui/IconButton";

type BottomSheetProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

/** Map's bottom sheet — drag-handle (visual only, matching Stitch: no real
 * sheet physics there either) → title/close row → content slot.
 *
 * Closes on Escape and moves focus to the close button on open, since this
 * is the first component in the library with real overlay semantics. */
export function BottomSheet({ title, onClose, children }: BottomSheetProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      aria-label={title}
      className="absolute inset-x-0 bottom-0 z-30 max-h-[70%] overflow-y-auto rounded-t-3xl bg-surface-container-lowest shadow-[var(--shadow-sheet)]"
      role="dialog"
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
    </div>
  );
}
