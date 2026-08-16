"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import type { ComponentProps } from "react";
import { SearchField } from "@/components/patterns/SearchField";

type HomeHeroProps = {
  searchProps: Omit<ComponentProps<typeof SearchField>, "variant" | "className">;
  /** A real published cover photo, supplied by `HomeClient` from the
   * `useVenues()` data it already fetches — never a new request, never a
   * bundled asset. `null` while that query is still in flight (or if no
   * published venue has a cover image), which renders the same layout at
   * the same height over a flat `bg-cream`, so the hero never changes size
   * when the image arrives.
   *
   * A previous revision took an ordered candidate list and probed each
   * one's decoded `naturalWidth`, skipping any that looked too
   * low-resolution. That was removed as a defect: `naturalWidth` reports
   * the size of the *variant `next/image` served* (capped by `sizes` and
   * the viewport), not the source resolution, so on a phone every
   * candidate measured well under the threshold and the probe walked the
   * entire list every single load — five wasted image requests, and it
   * always landed on the last candidate regardless of quality. The signal
   * could not do the job it was added for, and it cost a request
   * waterfall, so selection is now a single deterministic choice made by
   * the caller. */
  imageUrl?: string | null;
};

/** Home Hero — COASTAL EDITORIAL MIGRATION. Replaces the previous
 * search-field-only band with the approved photographic arrival moment: a
 * shallow (176px) full-bleed coastal photograph, a navy wash for legibility,
 * and the existing `SearchField` sitting over its lower edge.
 *
 * Deliberately shallow, not a 100dvh marketing hero — the visitor still
 * reaches real discovery content (categories, Best Beaches) in one short
 * scroll, which was the whole point of the earlier refinement that stripped
 * this hero back. This adds photographic presence without giving that up.
 *
 * The greeting and wordmark are NOT duplicated here. They already live in
 * `TopAppBar` directly above this component, and the approved prototype's
 * version of this hero (which carried them over the image) was drawn
 * against a lab page that has no `TopAppBar` at all. Reproducing it
 * literally in production would print the greeting and wordmark twice on
 * the same screen, so the production mapping keeps navigation chrome where
 * it already lives and gives the hero the photograph plus the search field
 * only.
 *
 * No decorative artwork of any kind — no coastline SVGs, no dot grid, no
 * grain, no particles. The photograph is the only visual; everything else
 * is a gradient for text legibility.
 *
 * Motion: the image breathes (scale 1 -> 1.04 over 28s, mirrored, so it
 * eases back rather than snapping), and the search field reveals once on
 * mount (opacity + 8px rise, 400ms, the project's existing easing curve).
 * Both are transform/opacity only, and both collapse to a static frame
 * under `prefers-reduced-motion` via Framer's `useReducedMotion` — the same
 * posture every other motion primitive in this app already takes, not a
 * second motion system. */
export function HomeHero({ searchProps, imageUrl = null }: HomeHeroProps) {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative -mx-4 h-44 overflow-hidden">
      {imageUrl ? (
        <motion.div
          animate={reduceMotion ? { scale: 1 } : { scale: 1.04 }}
          className="absolute inset-0"
          initial={{ scale: 1 }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { duration: 28, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" }
          }
        >
          {/* `priority` — this is the largest above-the-fold image on the
            * app's most important route, so it is the LCP element. */}
          <Image
            alt=""
            aria-hidden="true"
            className="object-cover"
            fill
            priority
            sizes="100vw"
            src={imageUrl}
          />
        </motion.div>
      ) : (
        <div aria-hidden="true" className="absolute inset-0 bg-cream" />
      )}

      {/* Navy wash. Darker at both edges than in the middle: the top keeps
        * the seam with `TopAppBar` from reading as a hard cut, the bottom
        * carries the search field. Same navy as `.editorial-overlay`, but
        * its own stops — this band is 176px tall with content at the very
        * bottom, not a card with a title over an opaque base. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgb(13_59_102_/_0.45)_0%,rgb(13_59_102_/_0.05)_40%,rgb(13_59_102_/_0.18)_68%,rgb(13_59_102_/_0.62)_100%)]"
      />

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
        <SearchField {...searchProps} />
      </motion.div>
    </section>
  );
}
