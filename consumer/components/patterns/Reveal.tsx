"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Stagger offset in seconds — e.g. a featured card entering slightly
   * ahead of the secondary cards beside it. */
  delay?: number;
};

/** Motion & Micro-Interactions Upgrade — restrained scroll-entrance for
 * major sections (a `SectionHeader` + its rail/grid together, not each
 * card individually — `CardCarousel`'s existing `.rail-stagger` CSS
 * already staggers the cards inside once the section has mounted).
 *
 * `viewport={{ once: true }}` is the whole implementation of "animate only
 * once, don't replay on scroll-back" — Framer's `whileInView` unobserves
 * after the first trigger instead of hand-rolling an IntersectionObserver.
 * `useReducedMotion` renders a plain, unanimated `div` — not just a
 * zero-duration motion component — so a reduced-motion user never pays for
 * Framer's mount cost on a piece of static content, on top of (not instead
 * of) the blanket CSS override in globals.css that already kills every
 * *CSS* transition/animation; Framer's transforms run via the Web
 * Animations API and aren't guaranteed to be caught by that same CSS
 * rule, so this is the real reduced-motion guarantee for anything in this
 * file. */
export function Reveal({ children, className = "", delay = 0 }: RevealProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
      viewport={{ once: true, margin: "-40px" }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      {children}
    </motion.div>
  );
}
