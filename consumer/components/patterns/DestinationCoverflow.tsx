"use client";

import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "framer-motion";
import {
  Children,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { CardCarousel } from "@/components/patterns/CardCarousel";

/** Coverflow presentation for Home's "Explore Destinations" rail ONLY
 * (SAHELSPOT CONSUMER — 21st.dev Coverflow Carousel integration). Adapts
 * the interaction reference at 21st.dev/@ruixen.ui/components/coverflow-
 * carousel — a fractional "position" value drives every card's transform,
 * pointer drag updates that position directly, release settles on the
 * nearest card — without porting its architecture: no raw-DOM RAF painting
 * (this codebase's established pattern, set by `DockCategoryRail`, drives
 * per-card transforms off a single `useMotionValue` via `useTransform`
 * instead), no `cn`/shadcn dependency, no new card component. Every card
 * passed in as `children` is an unmodified existing `DestinationCard` —
 * this component only owns the wrapper transforms around it.
 *
 * Deliberately not looping (the reference defaults to `loop: true`):
 * destinations are in a real geographic order (Alexandria → Marsa Matrouh,
 * see `lib/home/destinationOrder.ts`), and wrapping the ring would break
 * that sequence's meaning for no benefit here.
 *
 * Values are the reference's own knobs (`rotate`, `depth`, `perspective`,
 * `fade`) turned down hard — this task's explicit "significantly more
 * restrained" instruction, not the demo's dramatic defaults:
 *   rotate    44deg → 14deg
 *   depth     0.6   → a small fixed px recession
 *   perspective 3×  → 7× card width (larger multiplier = a flatter, subtler
 *               lens)
 *   fade      cards recede in opacity but never drop far, so a peeking
 *               neighbor still reads as "there," not "gone"
 *
 * `useReducedMotion` doesn't shorten the choreography — it removes the
 * whole thing and falls back to the exact plain horizontal `CardCarousel`
 * row Explore Destinations used before this change, per the brief's
 * "preserve carousel usability, remove animated rotation/perspective." */

const ROTATE_DEG = 14;
const DEPTH_PX = 34;
const CLICK_SUPPRESS_PX = 6;
/** COASTAL EDITORIAL MIGRATION — how far off-center the Coverflow starts
 * before settling, as a fraction of one card-spacing (not a full card), so
 * the settle reads as "arriving" rather than "flying in". */
const SETTLE_OFFSET = 0.6;
/** The discoverability nudge's peak displacement, in the same units.
 * Deliberately small: enough to read as "this responds to a pull", never
 * enough to look like the row changed cards by itself. */
const NUDGE_OFFSET = 0.18;
/** Fraction of card width between each card's center — under 1 so
 * neighbors overlap the active card's edges rather than sitting fully
 * clear of it, which is what lets them visibly "peek" within the section's
 * normal width instead of needing a full extra card-width of space each
 * side. */
const SPACING_RATIO = 0.62;

function CoverflowCard({
  index,
  pos,
  cardWidth,
  children,
}: {
  index: number;
  pos: MotionValue<number>;
  cardWidth: number;
  children: ReactNode;
}) {
  const offset = useTransform(pos, (p) => index - p);
  const distance = useTransform(offset, Math.abs);
  const x = useTransform(offset, (o) => o * cardWidth * SPACING_RATIO);
  // Range-mapped, not a continuous multiply — clamps automatically outside
  // ±1, so a second-away card holds at the same restrained tilt/scale/depth
  // instead of rotating or shrinking further the farther out it sits. Same
  // technique `DockCategoryRail` already uses for its own proximity falloff.
  const rotateY = useTransform(offset, [-1, 0, 1], [ROTATE_DEG, 0, -ROTATE_DEG]);
  const z = useTransform(offset, [-1, 0, 1], [-DEPTH_PX, 0, -DEPTH_PX]);
  const scale = useTransform(offset, [-1, 0, 1], [0.9, 1, 0.9]);
  const opacity = useTransform(offset, [-2, -1, 0, 1, 2], [0.5, 0.82, 1, 0.82, 0.5]);
  const zIndex = useTransform(distance, (d) => Math.round(100 - d * 10));
  // Elevation for the active card comes from a wrapper-level drop-shadow,
  // not from touching `CardFrame`'s own shadow — the card itself is never
  // redesigned, only what surrounds it.
  const filter = useTransform(
    distance,
    (d) => `drop-shadow(0 ${Math.max(2, 10 - d * 4)}px ${Math.max(4, 20 - d * 6)}px rgb(46 42 37 / ${Math.max(0.04, 0.2 - d * 0.07)}))`,
  );

  return (
    <motion.div
      data-coverflow-card
      style={{
        position: "absolute",
        left: "50%",
        top: 0,
        marginLeft: -cardWidth / 2,
        width: cardWidth,
        x,
        z,
        rotateY,
        scale,
        opacity,
        zIndex,
        filter,
      }}
    >
      {children}
    </motion.div>
  );
}

export function DestinationCoverflow({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const items = Children.toArray(children);
  const count = items.length;

  const frameRef = useRef<HTMLDivElement>(null);
  // Initial-centering fix — the Coverflow must open focused on the middle
  // destination, not the first one. `Math.floor((count - 1) / 2)` is
  // index-based, not a pixel offset, so it's correct at any viewport width
  // without measurement: for 11 destinations that's index 5, matching
  // "position that destination at the horizontal center" exactly, and it
  // stays correct if the published destination count ever changes. Every
  // per-card transform already derives from `index - pos` (see
  // `CoverflowCard`), so starting `pos` here is the only change needed —
  // the same offset math that centers the active card after a drag centers
  // it identically on first paint.
  const centerIndex = Math.floor((count - 1) / 2);
  // COASTAL EDITORIAL MIGRATION — starts offset from `centerIndex` and is
  // animated to it once on mount (see the settle effect below), rather than
  // resting at center on first paint as before. The centering *target* is
  // unchanged; only the arrival is now animated.
  const pos = useMotionValue(centerIndex + SETTLE_OFFSET);
  const [cardWidth, setCardWidth] = useState(256);
  // Measured directly from the rendered card, not derived from width — the
  // real `DestinationCard` isn't square (image + a navy content block
  // below it), so its height doesn't follow a fixed ratio of its width.
  const [cardHeight, setCardHeight] = useState(240);
  const dragRef = useRef<{
    id: number;
    startX: number;
    startPos: number;
    lastX: number;
    lastT: number;
    v: number;
    moved: number;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const hasUserInteracted = useRef(false);
  const settleStarted = useRef(false);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const measure = () => {
      const first = frame.querySelector<HTMLElement>("[data-coverflow-card]");
      if (!first) return;
      setCardWidth(first.offsetWidth);
      setCardHeight(first.offsetHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [count]);

  // COASTAL EDITORIAL MIGRATION — the first-paint settle, then one single
  // discoverability nudge. Both exist because nothing on screen otherwise
  // signals that this row is draggable: on touch there is no hover cue to
  // discover, so a user could reasonably read the Coverflow as a static
  // arrangement.
  //
  // Both are hard-gated to fire at most once per mount (`settleStarted`),
  // and both bail the moment a real drag begins (`hasUserInteracted`), so
  // the scripted motion can never fight the user's own gesture or replay on
  // scroll, re-render, or after an interaction. The nudge is chained off
  // the settle's own promise rather than a timer or a loop, which is what
  // makes "exactly once" structural rather than a matter of timing.
  useEffect(() => {
    if (reduceMotion || settleStarted.current || count === 0) return;
    settleStarted.current = true;

    const settle = animate(pos, centerIndex, {
      type: "spring",
      stiffness: 260,
      damping: 30,
      onComplete: () => {
        if (hasUserInteracted.current) return;
        animate(pos, centerIndex + NUDGE_OFFSET, {
          type: "spring",
          stiffness: 220,
          damping: 22,
        }).then(() => {
          if (hasUserInteracted.current) return;
          animate(pos, centerIndex, { type: "spring", stiffness: 220, damping: 26 });
        });
      },
    });

    return () => settle.stop();
    // Mount-only on purpose: `centerIndex`/`pos` are stable for a given
    // mounted rail, and re-running this on any later render is precisely
    // the "replays after every interaction" behavior the brief rules out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (reduceMotion) {
    // No transforms at all under reduced motion — the same plain scroll
    // rail every other Home carousel already uses, not a stripped-down
    // Coverflow.
    return <CardCarousel gap="lg">{children}</CardCarousel>;
  }

  const clampPos = (value: number) => Math.max(0, Math.min(count - 1, value));
  const spacing = cardWidth * SPACING_RATIO;

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    // Cancels any settle/nudge still in flight from taking over mid-gesture.
    hasUserInteracted.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      id: event.pointerId,
      startX: event.clientX,
      startPos: pos.get(),
      lastX: event.clientX,
      lastT: performance.now(),
      v: 0,
      moved: 0,
    };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId || !spacing) return;
    const now = performance.now();
    const stepDx = event.clientX - drag.lastX;
    drag.v = (stepDx / Math.max(now - drag.lastT, 1)) * 1000;
    drag.lastX = event.clientX;
    drag.lastT = now;
    drag.moved += Math.abs(stepDx);
    pos.set(clampPos(drag.startPos - (event.clientX - drag.startX) / spacing));
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    dragRef.current = null;
    // A flick carries at most one extra card — restrained, matching every
    // other restraint value in this file, not a multi-card throw.
    const carried = spacing ? Math.max(-1, Math.min(1, (drag.v / spacing) * 0.15)) : 0;
    const target = clampPos(Math.round(pos.get() + carried));
    animate(pos, target, { type: "spring", stiffness: 500, damping: 40 });
    suppressClickRef.current = drag.moved > CLICK_SUPPRESS_PX;
  }

  return (
    <div
      className="relative w-full overflow-hidden py-2"
      onClickCapture={(event) => {
        // A genuine drag must not also fire the destination `Link`'s
        // navigation — a tap (no meaningful movement) still reaches it
        // untouched.
        if (suppressClickRef.current) {
          event.preventDefault();
          event.stopPropagation();
          suppressClickRef.current = false;
        }
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      ref={frameRef}
      role="region"
      aria-label="Explore Destinations"
      style={{
        perspective: cardWidth * 7,
        touchAction: "pan-y",
        cursor: "grab",
      }}
    >
      <div className="relative" style={{ height: cardHeight, transformStyle: "preserve-3d" }}>
        {items.map((child, index) => (
          <CoverflowCard cardWidth={cardWidth} index={index} key={index} pos={pos}>
            {child}
          </CoverflowCard>
        ))}
      </div>
    </div>
  );
}
