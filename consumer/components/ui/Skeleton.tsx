type SkeletonProps = {
  className?: string;
};

/** Loading placeholder. Always sized by the caller to match the real
 * component's dimensions — a skeleton that doesn't reserve the right space is
 * a layout shift with extra steps, so there are no default dimensions here.
 *
 * The shimmer is a plain `animate-pulse`; the global reduced-motion rule in
 * globals.css stops it. */
export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-lg bg-surface-container ${className}`}
    />
  );
}
