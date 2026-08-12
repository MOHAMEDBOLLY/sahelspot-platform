"use client";

import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Motion & Micro-Interactions Upgrade, item 9 — a lightweight per-route
 * enter transition: `opacity + translateX(12px)`, ~220ms, keyed by
 * `pathname` so a tab switch (Home ↔ Explore ↔ Map ↔ Saved ↔ More) or a
 * push navigation (Search, Venue Details) replays it.
 *
 * Deliberately enter-only, not a full `AnimatePresence` exit/enter
 * crossfade: the old page's content is server-rendered per route in the
 * App Router, so choreographing its *exit* would mean holding the previous
 * route's tree mounted past navigation — real complexity and risk against
 * navigation this task explicitly locks, for a difference that reads as
 * "almost invisible" either way per the brief's own framing. The enter
 * animation alone already delivers "next page fades/slides slightly in."
 *
 * Rendered once per route-group layout ((root) and (push)), around
 * `children` — not around `BottomNav`, which must stay static chrome, not
 * something that re-animates on every tab switch. */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <>{children}</>;
  }

  return (
    <motion.div
      animate={{ opacity: 1, x: 0 }}
      initial={{ opacity: 0, x: 12 }}
      key={pathname}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
