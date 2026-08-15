"use client";

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { CategoryChip } from "@/components/patterns/CategoryChip";
import type { HomeActivity } from "@/lib/home/activities";

/** Dock Interaction — Home's "What do you want to do?" rail ONLY
 * (SAHELSPOT CONSUMER — VISUAL RICHNESS PASS, Dock integration). Explicitly
 * scoped away from `BottomNav`, which this file does not import, reference,
 * or affect in any way — a completely separate component tree.
 *
 * Adapts the *interaction idea* of a provided Apple-style Dock demo
 * (`useMotionValue`/`useTransform`/`useSpring` cursor-proximity
 * magnification) without porting its architecture: no `DockProvider`
 * context, no `role="button"` item wrappers, no gray/dark-mode styling.
 * `CategoryChip` — the existing, shared component also used by Explore's
 * "Browse by Category" — is rendered completely unchanged inside a motion
 * wrapper; this file owns only the wrapper's scale/press behavior, never
 * the chip's own markup, colors, or accessible name. Explore's usage of
 * `CategoryChip` is untouched by this file existing. */

const SPRING = { mass: 0.15, stiffness: 260, damping: 20 };
/** Restrained per the brief: "the icon subtly magnifies," not a literal
 * Mac Dock. 1.12 (was the demo's 80px/40px ≈ 2x) reads as "responds to my
 * pointer," not "this is an Apple Dock." */
const MAGNIFY_SCALE = 1.12;
/** Influence radius in px — how close the pointer needs to be before a
 * neighboring item starts responding, matching the demo's proportional
 * falloff (full magnification at 0, back to 1 at ±DISTANCE). */
const DISTANCE = 90;

function DockCategoryItem({
  activity,
  mouseX,
  reduceMotion,
  onSelect,
}: {
  activity: HomeActivity;
  mouseX: MotionValue<number>;
  reduceMotion: boolean;
  onSelect: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Hooks always run (rules-of-hooks) — whether their result is actually
  // applied to `style` below is gated on `magnifyEnabled`/`reduceMotion`,
  // not the hook calls themselves.
  const distance = useTransform(mouseX, (value) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return DISTANCE;
    return value - rect.left - rect.width / 2;
  });
  const scaleTransform = useTransform(distance, [-DISTANCE, 0, DISTANCE], [1, MAGNIFY_SCALE, 1]);
  // Press state lives in its own MotionValue and is *multiplied* into the
  // same chain the proximity magnify feeds, rather than being applied via
  // `whileTap`'s `scale` gesture target. `style.scale` below is already
  // bound to an external MotionValue (`magnifySpring`) — layering a
  // `whileTap={{ scale }}` animation on top of that same transform
  // property on the same element makes Framer Motion's gesture-driven
  // animation and the externally-bound style value fight over ownership of
  // `scale`, which is what was breaking the dock interaction on desktop
  // (the only place `style.scale` is actually bound). Routing press
  // through `onTapStart`/`onTap`/`onTapCancel` — plain callbacks, not a
  // competing animation controller — composes cleanly with magnify instead.
  const pressed = useMotionValue(1);
  const combinedScale = useTransform([scaleTransform, pressed], ([scale, press]: number[]) => scale * press);
  const magnifySpring = useSpring(combinedScale, SPRING);

  const onPressChange = reduceMotion ? undefined : (isPressed: boolean) => pressed.set(isPressed ? 0.94 : 1);

  return (
    <motion.div
      className="w-16 shrink-0 snap-start"
      ref={ref}
      // "tapped category gets a subtle scale/lift" (mobile) and the tap
      // feedback on desktop both flow through this one bound MotionValue —
      // `magnifySpring` is always applied (not gated on `magnifyEnabled`)
      // so press feedback still works on touch, where proximity magnify is
      // never active. Disabled outright under reduced motion rather than
      // shortened, per "remove large transforms... preserve only essential
      // state transitions."
      style={reduceMotion ? undefined : { scale: magnifySpring }}
      onTapStart={onPressChange ? () => onPressChange(true) : undefined}
      onTap={onPressChange ? () => onPressChange(false) : undefined}
      onTapCancel={onPressChange ? () => onPressChange(false) : undefined}
    >
      <CategoryChip icon={activity.icon} label={activity.label} onClick={onSelect} variant="dock" />
    </motion.div>
  );
}

export function DockCategoryRail({
  activities,
  onSelect,
}: {
  activities: readonly HomeActivity[];
  onSelect: (activity: HomeActivity) => void;
}) {
  const reduceMotion = useReducedMotion() ?? false;
  const mouseX = useMotionValue(Infinity);
  // "Do not force mouse-specific behavior onto touch" — gated on a real
  // fine-pointer/hover-capable device (`matchMedia`), not just "did a
  // mousemove event fire," since some touch browsers emit synthetic mouse
  // events after a tap that would otherwise trigger a one-off magnification
  // with no continuous pointer behind it.
  const [magnifyEnabled, setMagnifyEnabled] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(hover: hover) and (pointer: fine)");
    setMagnifyEnabled(query.matches);
    const onChange = (event: MediaQueryListEvent) => setMagnifyEnabled(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return (
    <div
      // Same three CSS mechanisms (bleed / snap / hidden scrollbar) the
      // rail already used before this change — horizontal scroll and snap
      // behavior are untouched, only the children changed.
      className="hide-scrollbar -mx-4 flex snap-x scroll-pl-4 items-end gap-3 overflow-x-auto px-4 pb-2"
      onMouseLeave={magnifyEnabled ? () => mouseX.set(Infinity) : undefined}
      onMouseMove={magnifyEnabled ? (event) => mouseX.set(event.pageX) : undefined}
    >
      {activities.map((activity) => (
        <DockCategoryItem
          activity={activity}
          key={activity.id}
          mouseX={mouseX}
          onSelect={() => onSelect(activity)}
          reduceMotion={reduceMotion}
        />
      ))}
    </div>
  );
}
