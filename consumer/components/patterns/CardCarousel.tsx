import type { ReactNode } from "react";

type CardCarouselProps = {
  children: ReactNode;
  className?: string;
  /** `"default"` (16px) everywhere except a rail deliberately given more
   * breathing room — Visual Richness / Art Direction Pass, item 5 (visual
   * rhythm): Explore Destinations uses `"lg"` (20px) as one of the "impact"
   * moments, the rest stay at the family default. A prop, not a raw
   * `className` gap override — two Tailwind `gap-*` utilities in one string
   * race on generated stylesheet order, not the order they're written in,
   * so this is the only reliable way to vary it per call site. */
  gap?: "default" | "lg";
};

/** Horizontal scroll wrapper — Home's Trending Today and Hidden Gems, Map's
 * Popular Nearby, Explore's Quick Browse. `-mx-4 px-4` lets the row bleed past
 * the screen's own padding so the first/last card don't look clipped, exactly
 * as the export's `-mx-4 px-4` does.
 *
 * Native scroll snap, so it's keyboard- and trackpad-scrollable with no JS.
 * Degrades to a grid above `md` (Phase 11) — that swap happens at the call
 * site, not in this component. */
export function CardCarousel({ children, className = "", gap = "default" }: CardCarouselProps) {
  return (
    <div
      className={`hide-scrollbar rail-stagger -mx-4 flex snap-x overflow-x-auto px-4 pb-2 ${
        gap === "lg" ? "gap-5" : "gap-4"
      } ${className}`}
    >
      {children}
    </div>
  );
}
