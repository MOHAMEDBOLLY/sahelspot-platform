"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";

type EditorialBreakProps = {
  /** A real published cover photo, supplied by the caller from data it has
   * already fetched. Renders nothing at all when `null` — see below. */
  imageUrl: string | null;
  eyebrow: string;
  headline: string;
};

/** The Editorial Break — COASTAL EDITORIAL MIGRATION, the single most
 * important structural change of this pass.
 *
 * Home was eight consecutive `SectionHeader + CardCarousel` rows: every
 * section the same shape, so the page read as a long list regardless of how
 * well each individual rail was built. This is the deliberate interruption
 * in that rhythm, placed between Trending and Events. It is NOT another
 * carousel, card, or grid: full-bleed photograph, no card frame, no radius,
 * no rail, no section header, one short line of type.
 *
 * Renders `null` rather than a placeholder when no image is available. A
 * photographic pause with no photograph is not a quieter version of this
 * section, it is a broken one — and the whole section is decorative in the
 * strict sense (it carries no venue, no link, no data the visitor can act
 * on), so omitting it costs the page nothing. This matches the "omit what
 * has no real source" rule the rest of this codebase already follows.
 *
 * Non-interactive by design: no link, no button, no focusable child. The
 * headline is a `<p>`, not a heading — it is a brand statement, not a
 * section title, and promoting it to `<h2>` would inject a phantom entry
 * into Home's heading outline between "Trending" and "Upcoming Events".
 *
 * Motion: one scroll-triggered reveal (opacity + 16px rise, 500ms, the
 * project's existing easing), fired once via `viewport={{ once: true }}` —
 * the same `Reveal` language every other Home section already uses, not a
 * new effect. The photograph itself never moves: no parallax, no ambient
 * scale. Ambient motion is reserved for the Hero so it stays a signature
 * rather than a page-wide mannerism. */
export function EditorialBreak({ imageUrl, eyebrow, headline }: EditorialBreakProps) {
  const reduceMotion = useReducedMotion();

  if (!imageUrl) return null;

  return (
    <motion.section
      // `-mx-4` bleeds past `<main>`'s own `px-4` so the image spans the
      // full width of the content container, which is what makes this read
      // as an interruption rather than another padded block in the stack.
      className="relative -mx-4 mt-12 h-72 overflow-hidden"
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      viewport={{ once: true, margin: "-60px" }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      <Image alt="" aria-hidden="true" className="object-cover" fill sizes="100vw" src={imageUrl} />
      <div
        aria-hidden="true"
        className="editorial-break-overlay pointer-events-none absolute inset-0"
      />
      <div className="absolute inset-x-6 bottom-8 max-w-sm">
        <p className="text-xs font-semibold tracking-wide text-white/70 uppercase">{eyebrow}</p>
        <p className="font-headline mt-2 text-3xl leading-[1.05] font-bold text-white">{headline}</p>
      </div>
    </motion.section>
  );
}
