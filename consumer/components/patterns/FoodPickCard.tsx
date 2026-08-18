import Image from "next/image";
import { CardFrame, SaveButton } from "@/components/patterns/CardShell";
import type { Venue } from "@/lib/domain/venue";

type FoodPickCardProps = {
  venue: Venue;
  saved: boolean;
  onToggleSaved?: (venueId: string) => void;
};

/** Home's Food Picks rail ONLY (SAHELSPOT CONSUMER — HOME UI REFINEMENT).
 * Food content is primarily logo/brand-driven, not photography-driven, so
 * this is a dedicated compact square card rather than a smaller copy of the
 * standard `VenueCard` — the standard card's title→status→location→rating
 * stack left too much empty space below a logo that has no rating or open/
 * closed state worth showing here. `object-contain` on a neutral sand
 * backdrop keeps a text-heavy logo fully legible instead of letting
 * `object-cover` crop it, and the image area alone accounts for most of the
 * card's height — approximately 1:1 overall — so this rail can show several
 * venues in one viewport instead of a handful of tall portrait cards.
 *
 * Home-only: does not touch `VenueCard` or any other screen that renders
 * food venues (Search, Venue Details' Similar Experiences, ...). */
export function FoodPickCard({ venue, saved, onToggleSaved }: FoodPickCardProps) {
  return (
    <CardFrame className="w-28" href={`/venues/${venue.id}`}>
      <div className="relative aspect-square bg-cream p-2.5">
        {venue.coverImageUrl ? (
          <Image
            alt={venue.name}
            className="object-contain"
            fill
            sizes="112px"
            src={venue.coverImageUrl}
          />
        ) : null}
      </div>
      <SaveButton
        className="absolute top-0 left-0"
        compact
        onToggleSaved={onToggleSaved}
        saved={saved}
        venueId={venue.id}
      />
      <div className="space-y-0.5 p-2 pt-1.5">
        <h3 className="truncate text-[11px] leading-tight font-bold text-on-surface">{venue.name}</h3>
        <p className="truncate text-[10px] text-on-surface-variant">{venue.destinationName}</p>
      </div>
    </CardFrame>
  );
}
