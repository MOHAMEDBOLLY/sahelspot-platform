type SkeletonProps = {
  className?: string;
};

/** Loading placeholder. Always sized by the caller to match the real
 * component's dimensions — a skeleton that doesn't reserve the right space is
 * a layout shift with extra steps, so there are no default dimensions here.
 *
 * Motion & Micro-Interactions Upgrade, item 10 — a soft diagonal shimmer
 * sweep layered on top of the base `animate-pulse`, not a replacement for
 * it: the pulse alone reads as "loading," the shimmer adds the "premium,
 * not aggressive" polish the brief asks for without introducing a second,
 * unrelated animation primitive. Both are plain CSS `animation`s, so the
 * existing global `prefers-reduced-motion` rule in globals.css (which zeroes
 * every animation-duration) stops them exactly the same way it always did —
 * no extra reduced-motion handling needed here. */
export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`relative animate-pulse overflow-hidden rounded-lg bg-surface-container ${className}`}
    >
      <div className="skeleton-shimmer absolute inset-0" />
    </div>
  );
}
