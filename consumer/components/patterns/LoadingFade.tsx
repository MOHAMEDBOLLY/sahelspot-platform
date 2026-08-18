"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useRef } from "react";
import type { ReactNode } from "react";

const EASE = [0.16, 1, 0.3, 1] as const;

/** Skeleton -> Content crossfade — Motion Pass 01. The single shared
 * implementation for the most-repeated static seam in the app: every
 * data-backed section hard-swapping its skeleton for real content the
 * instant a query resolves. Reuses the app's existing entrance language
 * (`Reveal`'s opacity + 8px rise, the shared `[0.16,1,0.3,1]` easing)
 * rather than inventing a new one.
 *
 * Deliberately NOT `AnimatePresence`/`mode="wait"` — an exit-then-enter
 * choreography needs the skeleton's exit animation to actually fire its
 * completion callback before the content is allowed to mount, and with
 * six-plus of these mounted at once on Home alone, that two-phase
 * handshake proved unreliable (content permanently stuck behind a
 * "still exiting" skeleton). Instead: the skeleton is swapped out the
 * instant `loading` flips (no exit animation to depend on), and only the
 * *entering* content fades + rises in — still a real transition, just a
 * one-directional one that can't get stuck waiting on the outgoing
 * element.
 *
 * Two refs, not the `loading` prop alone: `wasLoading` captures whether
 * this section was ever actually in its loading state (so a page that
 * mounts with data already resolved — e.g. a warm cache — renders
 * `children` immediately with no animation, since there was no real
 * transition to show); `hasAnimated` makes sure the fade only plays once
 * per section, not on every subsequent re-render once already shown.
 *
 * Visual only: does not change when content is considered loaded, error,
 * or empty — `children` is whatever the caller already renders for the
 * non-loading case (error/empty/success), unchanged. */
export function LoadingFade({
  loading,
  skeleton,
  children,
}: {
  loading: boolean;
  skeleton: ReactNode;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const wasLoading = useRef(loading);
  const hasAnimated = useRef(false);

  if (loading) {
    wasLoading.current = true;
    return <>{skeleton}</>;
  }

  if (reduceMotion || !wasLoading.current || hasAnimated.current) {
    return <>{children}</>;
  }
  hasAnimated.current = true;

  return (
    <motion.div animate={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 8 }} transition={{ duration: 0.2, ease: EASE }}>
      {children}
    </motion.div>
  );
}
