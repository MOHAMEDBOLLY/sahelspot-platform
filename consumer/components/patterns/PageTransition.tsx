"use client";

import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type PageTransitionVariant = "tab" | "push";

/** Motion & Micro-Interactions Upgrade, item 9, revised by P1.1 (Design &
 * Motion Audit) — the original single behavior (`opacity + translateX(12px)`,
 * ~220ms, keyed by `pathname`) fired on every route change alike, including
 * the five root tabs (Home ↔ Explore ↔ Map ↔ Saved ↔ More), which are
 * switched far more often than a push navigation and don't represent moving
 * into a deeper surface — a directional slide there reads as unearned
 * spatial movement, not feedback.
 *
 * `variant` is supplied once per route-group layout, not per page — the
 * classification lives at the same structural boundary that already
 * separates root-tab screens from pushed detail screens (`(root)/layout.tsx`
 * vs. `(push)/layout.tsx`), so no individual route ever has to opt in or out
 * itself:
 *   - `"tab"`  — root-tab switches. Renders `children` directly, keyed by
 *     `pathname` so React still remounts the subtree on tab change (matching
 *     prior behavior for state/scroll reset) without adding any enter
 *     animation.
 *   - `"push"` — pushed detail screens (Venue Details, Event Details,
 *     Search). Unchanged from before: the same 220ms opacity+translateX(12px)
 *     spatial cue, since arriving at a deeper surface is the one case that
 *     cue was built for.
 *
 * Deliberately enter-only for `"push"`, not a full `AnimatePresence`
 * exit/enter crossfade: the old page's content is server-rendered per route
 * in the App Router, so choreographing its *exit* would mean holding the
 * previous route's tree mounted past navigation — real complexity against
 * navigation this task explicitly locks, for a difference that reads as
 * "almost invisible" either way.
 *
 * Rendered once per route-group layout, around `children` — not around
 * `BottomNav`, which must stay static chrome, not something that
 * re-animates on every tab switch. */
export function PageTransition({
  children,
  variant = "push",
}: {
  children: ReactNode;
  variant?: PageTransitionVariant;
}) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  if (reduceMotion || variant === "tab") {
    return <div key={pathname}>{children}</div>;
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
