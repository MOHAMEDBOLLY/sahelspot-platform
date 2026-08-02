import type { ReactNode } from "react";

type CardCarouselProps = {
  children: ReactNode;
  className?: string;
};

/** Horizontal scroll wrapper — Home's Trending Today and Hidden Gems, Map's
 * Popular Nearby, Explore's Quick Browse. `-mx-4 px-4` lets the row bleed past
 * the screen's own padding so the first/last card don't look clipped, exactly
 * as the export's `-mx-4 px-4` does.
 *
 * Native scroll snap, so it's keyboard- and trackpad-scrollable with no JS.
 * Degrades to a grid above `md` (Phase 11) — that swap happens at the call
 * site, not in this component. */
export function CardCarousel({ children, className = "" }: CardCarouselProps) {
  return (
    <div
      className={`hide-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 ${className}`}
    >
      {children}
    </div>
  );
}
