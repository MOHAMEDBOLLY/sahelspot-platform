import { Icon } from "./Icon";

type RatingStarsProps = {
  value: number;
  reviewCount?: number;
};

/** Venue Details hero rating row. Order is numeric first, confirmed from the
 * Boca Beach export: "4.8" (bold gold) -> 5 gold stars, using `star_half` for
 * the fractional half -> "(230 reviews)". The star row itself is
 * `aria-hidden`; the numeric value and count carry the meaning, so a screen
 * reader isn't told "star star star star half star" on top of "4.8". */
export function RatingStars({ value, reviewCount }: RatingStarsProps) {
  const fullStars = Math.floor(value);
  const hasHalf = value - fullStars >= 0.5;

  return (
    <div className="flex items-center gap-2">
      {/* Navy, not lime — same light-surface contrast fix as `RatingBadge`. */}
      <span className="text-lg font-bold text-primary">{value.toFixed(1)}</span>
      <div aria-hidden="true" className="flex text-primary">
        {Array.from({ length: 5 }, (_, index) => {
          const isFull = index < fullStars;
          const isHalf = !isFull && index === fullStars && hasHalf;
          return (
            <Icon
              filled
              key={index}
              name={isHalf ? "star_half" : "star"}
              size={16}
              className={isFull || isHalf ? "" : "text-outline-variant"}
            />
          );
        })}
      </div>
      {reviewCount !== undefined ? (
        <span className="text-sm text-on-surface-variant">({reviewCount} reviews)</span>
      ) : null}
    </div>
  );
}
