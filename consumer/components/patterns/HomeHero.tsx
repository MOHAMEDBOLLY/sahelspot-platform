"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import type { ComponentProps } from "react";
import { SearchField } from "@/components/patterns/SearchField";
import { LBracketAccent } from "@/components/patterns/CardShell";

type HomeHeroProps = {
  /** Real, data-derived line ("N destinations along the coast") rather than
   * invented marketing copy — omitted entirely while destinations haven't
   * loaded yet. */
  destinationCount?: number | null;
  searchProps: Omit<ComponentProps<typeof SearchField>, "variant" | "className">;
};

/** Home Hero — navy-restored background correction (SAHELSPOT CONSUMER —
 * FINAL HERO / BACKGROUND CORRECTION). Still imageless (no photography, no
 * illustration asset, no dependency — two inline SVG paths and a CSS
 * dot-grid, all resolved through existing color tokens). This pass replaces
 * the previous single blurred light-blue circle with an abstract composition
 * closer to the brief's reference: a navy "coastline" form entering from the
 * bottom-right, a fainter light-blue form layered behind it for depth, and a
 * very low-opacity dot grid across the panel.
 *
 * Deliberately NOT a literal wave/illustration: both shapes are a single
 * smooth diagonal curve closing against the canvas edges (an architectural
 * "coastline contour", not a wobbly blob-generator shape) — kept to two
 * large curves per path rather than many small ones, per the brief's
 * "cleaner, more premium, more minimal, more architectural" direction.
 *
 * Content (eyebrow/headline/subtitle/L-Bracket) stays anchored top-left on
 * the plain white surface, away from the shape entirely — avoids needing
 * conditional text-color logic and keeps the copy trivially readable
 * regardless of exactly how the shape renders. `LBracketAccent` keeps its
 * normal top-right-corner-of-a-light-surface role unchanged, since the navy
 * shape enters from the bottom/right edge rather than the top corner.
 *
 * Shape area is intentionally modest relative to the panel (roughly a
 * quarter to a third, bottom-right only) — the point is a strong navy
 * accent, not a navy-dominant hero; the surrounding white plus the light-blue
 * layer staying at low opacity is what keeps the panel reading as
 * "predominantly light" per the brief's 80–90% white / 10–15% navy ratio. */
function HeroBackground() {
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
      {/* Soft gradient wash — Visual Richness / Art Direction Pass. A barely-
        * perceptible diagonal tint (surface-lowest to surface-container-low)
        * beneath everything else, so the panel reads as a lit surface rather
        * than a flat fill before any shape is added — the first, quietest
        * layer of depth. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(155deg, var(--color-surface-container-lowest) 0%, var(--color-surface-container-low) 100%)",
        }}
      />
      {/* Grain — a material texture, not a pattern; kept under 3% opacity so
        * it reads as paper/plaster rather than a visible dither. */}
      <div className="grain-overlay absolute inset-0 opacity-[0.025]" />
      {/* Dot grid — a background detail meant to disappear into the surface. */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: "radial-gradient(circle, var(--color-primary) 1px, transparent 1px)",
          backgroundSize: "18px 18px",
        }}
      />
      {/* Secondary light-blue form — larger, further back, blurred for
        * separation from the navy form in front of it (foreground/background
        * depth, not just two flat shapes stacked at different opacities). */}
      <svg
        className="absolute -right-20 -bottom-24 h-64 w-56 opacity-[0.22] blur-md"
        preserveAspectRatio="none"
        viewBox="0 0 220 300"
      >
        <path
          d="M220,0 L220,300 L60,300 C25,250 55,190 95,160 C150,120 120,55 175,25 C195,13 210,5 220,0 Z"
          fill="var(--color-primary-light)"
        />
      </svg>
      {/* Primary navy form — the Hero's one strong accent. A soft drop-shadow
        * gives it a hairline of lift off the wash behind it (tactile depth,
        * not a glow) — "stronger Navy presence" per the brief, achieved
        * through weight/depth rather than more area. */}
      <svg
        className="absolute -right-10 -bottom-14 h-56 w-48"
        preserveAspectRatio="none"
        style={{ filter: "drop-shadow(-6px -4px 16px rgb(13 59 102 / 0.18))" }}
        viewBox="0 0 190 260"
      >
        <path
          d="M190,0 L190,260 L70,260 C40,215 65,165 100,140 C145,108 122,55 168,28 C177,23 184,10 190,0 Z"
          fill="var(--color-primary)"
        />
      </svg>
    </div>
  );
}

/** Skips the entrance replay on a tab switch back to Home within the same
 * browser session — Motion & Micro-Interactions Upgrade, item 1 ("should
 * run once per page session, not every time the user scrolls back to the
 * Hero"). `sessionStorage`, not a module-level variable: survives a full
 * page reload within the tab (still "the same session" to a user) while a
 * fresh tab/session gets the entrance again. */
const HERO_ENTRANCE_KEY = "sahelspot:hero-entrance-played";

/** Compact (no fixed image-hero height) so the Activity Rail and discovery
 * content stay one scroll away. Entrance motion is a small headline →
 * supporting-line → search stagger (450ms / +100ms / +100ms per the brief),
 * `opacity + translateY` only — no parallax, no background motion on load.
 * `useReducedMotion` (on top of the blanket CSS override in globals.css)
 * skips the animation entirely rather than just zeroing its duration, so a
 * reduced-motion visitor never pays for Framer's mount cost here either. */
export function HomeHero({ destinationCount, searchProps }: HomeHeroProps) {
  const reduceMotion = useReducedMotion();
  const [playEntrance, setPlayEntrance] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || window.sessionStorage.getItem(HERO_ENTRANCE_KEY)) return;
    window.sessionStorage.setItem(HERO_ENTRANCE_KEY, "1");
    setPlayEntrance(true);
  }, []);

  const animated = playEntrance && !reduceMotion;

  return (
    <section className="-mx-4 -mt-2">
      <div className="relative overflow-hidden rounded-b-3xl bg-surface-container-lowest px-4 pt-10 pb-16">
        <HeroBackground />
        <LBracketAccent size="lg" />
        <div className="relative">
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            initial={animated ? { opacity: 0, y: 14 } : false}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Visual Richness / Art Direction Pass — Hero typography.
              * Eyebrow drops a touch smaller/wider-tracked and gets its own
              * bottom margin (was just a stacked paragraph) so it reads as a
              * distinct label above the headline rather than a first line of
              * it. Headline goes up a full step (4xl/5xl → 5xl/6xl) with a
              * tighter `leading-[0.95]` — the "obvious primary" the brief
              * asks for — same copy, same content, just given more room to
              * be the loudest thing on the screen. */}
            <p className="mb-1.5 text-[11px] font-semibold tracking-[0.22em] text-on-surface-variant uppercase">
              Egypt&apos;s North Coast
            </p>
            <h1 className="font-headline text-5xl leading-[0.95] font-bold tracking-tight text-primary sm:text-6xl">
              North Coast
            </h1>
          </motion.div>
          {destinationCount ? (
            <motion.p
              animate={{ opacity: 1, y: 0 }}
              className="mt-2.5 text-sm font-medium text-on-surface-variant"
              initial={animated ? { opacity: 0, y: 10 } : false}
              transition={{ duration: 0.35, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              {destinationCount} destinations along the coast
            </motion.p>
          ) : null}
        </div>
      </div>

      {/* Net -32px overlap onto the panel's bottom edge — same construction
        * as `OverlapPanel` (margin pulled up, then translated back down by
        * half), scaled for the search bar's own height instead of a card
        * panel's. Wrapped back in `px-4` since the hero itself bled to the
        * screen edge above (`-mx-4`) but the search bar keeps the page's
        * normal content width, matching Search/Map's own `SearchField`
        * placement. The search bar plays last in the entrance stagger — the
        * closest thing this Hero has to a primary CTA (no literal CTA
        * button exists in this design), per the brief's "CTA appears last"
        * sequencing. */}
      {/* Static positioning (margin/transform) lives on this plain div, kept
        * separate from the `motion.div` below — Framer manages `transform`
        * itself for the entrance animation, so mixing a static
        * `transform: translateY(16px)` into the same animated element would
        * fight Framer's own transform and break the overlap offset once
        * the animation settled at `y: 0`. */}
      <div className="relative px-4" style={{ marginTop: "-32px", transform: "translateY(16px)" }}>
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          initial={animated ? { opacity: 0, y: 10 } : false}
          transition={{ duration: 0.35, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <SearchField {...searchProps} />
        </motion.div>
      </div>
    </section>
  );
}
