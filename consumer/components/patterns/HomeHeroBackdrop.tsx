"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";

type HomeHeroBackdropProps = {
  /** Same real published cover photo `HomeHero` used to render directly —
   * see `HomeClient`'s `heroImageUrl` for where it comes from. `null`
   * renders the same flat `bg-cream` fallback as before, at whatever
   * height the sibling in-flow content (search band + category section)
   * gives this backdrop's `relative` parent. */
  imageUrl?: string | null;
};

/** Hero → Category Background Fade — the single continuous background
 * layer behind `TopAppBar` (overlay), `HomeHero`'s search band, AND the
 * "What do you want to do?" category section, so the photograph reads as
 * one unbroken surface across all three instead of two independently-
 * cropped copies (which would visibly seam, since `object-cover` picks its
 * own centered crop per container height).
 *
 * Deliberately renders no height of its own: every layer here is
 * `absolute inset-0`/`absolute inset-x-0`, sized entirely by the nearest
 * `relative` ancestor — which gets its real height from the in-flow
 * siblings it also contains (the search band, the category section's own
 * content and bottom padding). This is what lets the backdrop's height
 * naturally track "however tall the Hero + Category composition actually
 * is" at each breakpoint, rather than a hardcoded pixel guess.
 *
 * Three layers, bottom to top:
 * 1. The photograph itself (breathing scale, same motion `HomeHero` used
 *    to carry directly).
 * 2. A top wash (unchanged from the previous `HomeHero`'s gradient) so
 *    `TopAppBar`'s overlay text and the search field stay legible.
 * 3. A bottom fade (`.hero-category-fade`, globals.css) — transparent at
 *    its own top edge, where the image is still fully clear immediately
 *    after the category cards, ramping to fully opaque `--color-surface`
 *    by its bottom edge, exactly where `<main>`'s plain background (and
 *    Best Beaches) begins. Background only: nothing here touches the
 *    category content's own opacity. */
export function HomeHeroBackdrop({ imageUrl = null }: HomeHeroBackdropProps) {
  const reduceMotion = useReducedMotion();

  return (
    // `-z-10` is load-bearing, not decorative: CSS paint order puts a
    // z-index:auto positioned element ABOVE its in-flow siblings (the
    // category section, the search band), so without an explicit negative
    // z-index this backdrop would render on top of and hide that content
    // instead of behind it.
    <div aria-hidden="true" className="absolute inset-0 -z-10">
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
          <Image alt="" aria-hidden="true" className="object-cover" fill priority sizes="100vw" src={imageUrl} />
        </motion.div>
      ) : (
        <div aria-hidden="true" className="absolute inset-0 bg-cream" />
      )}

      {/* Navy wash, unchanged from the previous `HomeHero` — same stops,
        * same purpose: the top edge keeps the seam with `TopAppBar` from
        * reading as a hard cut, the bottom carries the search field. Fixed
        * to the original 176px band height so it never bleeds into the
        * category section below. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[linear-gradient(to_bottom,rgb(13_59_102_/_0.45)_0%,rgb(13_59_102_/_0.05)_40%,rgb(13_59_102_/_0.18)_68%,rgb(13_59_102_/_0.62)_100%)]"
      />

      {/* Bottom fade — see `.hero-category-fade` (globals.css) for the
        * gradient stops. Height (Hero Background Extension follow-up:
        * `h-32 sm:h-40`, was `h-28 sm:h-36`) is the one visually-tuned
        * constant here: tall enough, together with the category section's
        * own trailing `pb-10`, that the image and its fabric shadow keep
        * reading clearly into the space below the category labels before
        * fading, at both 390px and 1440px, without covering the category
        * cards (which sit well above this layer in normal document flow)
        * or pushing Best Beaches down (this layer is absolutely
        * positioned, so it adds no height of its own). */}
      <div aria-hidden="true" className="hero-category-fade pointer-events-none absolute inset-x-0 bottom-0 h-32 sm:h-40" />
    </div>
  );
}
