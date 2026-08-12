import { Icon } from "./Icon";

type RatingBadgeProps = {
  value: number;
  reviewCount?: number;
  /** `(180)` on Nearby rows vs. `(120 reviews)` on Home's Trending cards —
   * both are in the export, in different places. */
  compact?: boolean;
};

/** Compact single gold star + numeric + review count, used on every
 * `VenueCard` variant. */
export function RatingBadge({ value, reviewCount, compact = false }: RatingBadgeProps) {
  return (
    <div className="flex items-center gap-1">
      {/* Navy, not lime — same light-surface contrast fix as `SectionHeader`
        * ("See All"): lime reads at ~1.2:1 against this card's light
        * background, effectively invisible. */}
      <Icon className="text-primary" filled name="star" size={compact ? 16 : 18} />
      <span className="text-sm font-bold text-on-surface">{value.toFixed(1)}</span>
      {reviewCount !== undefined ? (
        <span
          className={compact ? "text-[10px] text-on-surface-variant" : "text-xs text-on-surface-variant"}
        >
          {compact ? `(${reviewCount})` : `(${reviewCount} reviews)`}
        </span>
      ) : null}
    </div>
  );
}
