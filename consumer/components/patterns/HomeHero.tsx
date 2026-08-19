"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ComponentProps } from "react";
import { SearchAutocomplete } from "@/components/patterns/SearchAutocomplete";

type HomeHeroProps = {
  searchProps: Omit<ComponentProps<typeof SearchAutocomplete>, "variant" | "className">;
};

/** Home Hero — COASTAL EDITORIAL MIGRATION, then Hero→Category Background
 * Fade pass. Originally this component owned the photograph and its navy
 * wash directly, self-contained in a 176px `overflow-hidden` band. Both
 * moved up to `HomeClient` (see its `heroBackdropUrl`/fade layer) when the
 * Hero→Category fade task required ONE continuous image spanning the Hero
 * band *and* the category section below it — two independently-`object-cover`-
 * cropped copies of the same photo, one per component, would not line up at
 * the seam (each picks its own centered crop against a different container
 * height), so a single shared background layer was the only way to keep it
 * seamless. This component is now search-field-only: it just reserves the
 * same 176px band (`h-44`) so the field lands exactly where it always has,
 * over whatever backdrop `HomeClient` renders behind it.
 *
 * The greeting and wordmark are NOT duplicated here. They already live in
 * `TopAppBar` directly above this component.
 *
 * Motion: the search field reveals once on mount (opacity + 8px rise,
 * 400ms, the project's existing easing curve), collapsing to a static frame
 * under `prefers-reduced-motion` via Framer's `useReducedMotion` — the same
 * posture every other motion primitive in this app already takes. The
 * photograph's own slow breathing scale now lives with the image itself in
 * `HomeClient`. */
export function HomeHero({ searchProps }: HomeHeroProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative h-44">
      {/* `initial` stays a stable object rather than flipping to `false`
        * under reduced motion: `useReducedMotion` returns `null` on the
        * server and resolves on the client, so a type-switching `initial`
        * makes Framer re-evaluate the entrance mid-flight. Reduced motion
        * is expressed as a zero-duration transition instead, which lands on
        * the same final state instantly with no movement. */}
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="absolute inset-x-4 bottom-4"
        initial={{ opacity: 0, y: 8 }}
        transition={
          reduceMotion ? { duration: 0 } : { duration: 0.4, ease: [0.16, 1, 0.3, 1] }
        }
      >
        <SearchAutocomplete {...searchProps} />
      </motion.div>
    </div>
  );
}
