import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { RatingBadge } from "@/components/ui/RatingBadge";
import { StatusBadge } from "@/components/patterns/StatusBadge";
import type { Venue } from "@/lib/domain/venue";

type VenueCardVariant = "vertical-lg" | "vertical-compact" | "horizontal-row";

type VenueCardProps = {
  venue: Venue;
  variant?: VenueCardVariant;
  saved?: boolean;
  onToggleSaved?: (venueId: string) => void;
};

/** One component, three variants — never three components. Anatomy of each
 * is read directly from the export rather than approximated:
 *
 * `vertical-lg`      Home Trending Today, Saved list.
 *                    rounded-3xl card, h-48 image, save FAB, body with
 *                    title/location/OPEN badge row + rating row.
 * `vertical-compact` Map bottom sheet Popular Nearby. Smaller image, adds
 *                    distance inline with category.
 * `horizontal-row`   Venue Details Nearby Places, Search results.
 *                    thumb + body + chevron, from the Boca Beach export.
 *
 * Every optional field (rating, isOpenNow, distanceLabel) must render
 * correctly when absent — the API gaps in API_REQUIREMENTS.md §1/§4 are not
 * blockers for this component. */
export function VenueCard({
  venue,
  variant = "vertical-lg",
  saved = false,
  onToggleSaved,
}: VenueCardProps) {
  const href = `/venues/${venue.id}`;

  if (variant === "horizontal-row") {
    return (
      <Link
        className="flex items-center gap-4 rounded-2xl border border-outline-variant/10 bg-surface-container-low p-3 shadow-sm transition-colors hover:bg-surface-container"
        href={href}
      >
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-cream">
          {venue.coverImageUrl ? (
            <Image
              alt={venue.name}
              className="object-cover"
              fill
              sizes="80px"
              src={venue.coverImageUrl}
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-grow space-y-1">
          <h3 className="truncate font-bold leading-tight text-primary">{venue.name}</h3>
          {venue.distanceLabel ? (
            <div className="flex items-center gap-1">
              <Icon className="text-secondary" name="location_on" size={16} />
              <span className="text-xs font-medium text-on-surface-variant">
                {venue.distanceLabel}
              </span>
            </div>
          ) : null}
          {venue.rating !== null ? (
            <RatingBadge compact reviewCount={venue.reviewCount ?? undefined} value={venue.rating} />
          ) : null}
        </div>
        <Icon className="text-primary" name="chevron_right" size={20} />
      </Link>
    );
  }

  const isCompact = variant === "vertical-compact";

  return (
    <Link
      className={`shrink-0 snap-start overflow-hidden rounded-3xl border border-outline-variant/10 bg-surface-container-lowest shadow-md transition-transform active:scale-[0.98] ${
        isCompact ? "w-56" : "w-[80%] min-w-[280px]"
      }`}
      href={href}
    >
      <div className={`relative ${isCompact ? "h-32" : "h-48"} bg-cream`}>
        {venue.coverImageUrl ? (
          <Image
            alt={venue.name}
            className="object-cover"
            fill
            sizes={isCompact ? "224px" : "280px"}
            src={venue.coverImageUrl}
          />
        ) : null}
        <span className="absolute top-3 right-3">
          <IconButton
            aria-pressed={saved}
            className={saved ? "text-tertiary" : "text-on-surface-variant/40"}
            icon="favorite"
            filled={saved}
            label={saved ? "Remove from saved" : "Save this place"}
            onClick={(event) => {
              event.preventDefault();
              onToggleSaved?.(venue.id);
            }}
            variant="solid"
          />
        </span>
      </div>
      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-lg leading-tight font-bold text-on-surface">
              {venue.name}
            </h3>
            <p className="flex items-center gap-1 text-sm text-on-surface-variant">
              <Icon className="shrink-0" name="location_on" size={16} />
              <span className="truncate">{venue.destinationName}</span>
            </p>
          </div>
          {venue.isOpenNow !== null ? <StatusBadge isOpen={venue.isOpenNow} /> : null}
        </div>
        <div className="flex items-center gap-1 pt-1">
          {venue.rating !== null ? (
            <RatingBadge reviewCount={venue.reviewCount ?? undefined} value={venue.rating} />
          ) : null}
          {isCompact && venue.distanceLabel ? (
            <span className="text-xs text-on-surface-variant">· {venue.distanceLabel}</span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
