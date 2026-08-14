import Image from "next/image";
import { CardFrame, SaveButton } from "@/components/patterns/CardShell";
import { Icon } from "@/components/ui/Icon";
import type { Venue } from "@/lib/domain/venue";

type NightlifeCardProps = {
  venue: Venue;
  saved: boolean;
  onToggleSaved?: (venueId: string) => void;
};

/** Home's Nightlife rail ONLY (SAHELSPOT CONSUMER — NIGHTLIFE CARD WIDTH
 * ADJUSTMENT). One venue, one card — unchanged from the prior pass. Width is
 * corrected down from that pass's `w-[78%]` (≈280px, roughly 2× a standard
 * rail card) to a fixed `w-[230px]`: about 64% of the 390×844 carousel's
 * available width (390 − 2×16px page padding = 358px), comfortably inside
 * the "55–65% of carousel width, next card clearly peeking" target, and
 * about 144% of a compact rail card's 160px width — "moderately wider," not
 * "2×." A dedicated `CardFrame`-based card rather than the standard
 * `VenueCard`, because Nightlife still wants a wide cinematic image
 * dominating the card with only name + destination underneath — no rating/
 * status row competing with the photo. Food Picks stays untouched and
 * visually opposite: small/square/logo-focused vs. this wider/photo-focused
 * card.
 *
 * Home-only: does not touch `VenueCard`, and does not change how Nightlife
 * venues render anywhere else (Search, Map's bottom sheet, ...). */
export function NightlifeCard({ venue, saved, onToggleSaved }: NightlifeCardProps) {
  return (
    <CardFrame className="w-[230px]" href={`/venues/${venue.id}`}>
      <div className="relative h-36 overflow-hidden bg-cream">
        {venue.coverImageUrl ? (
          <Image
            alt={venue.name}
            className="object-cover"
            fill
            sizes="230px"
            src={venue.coverImageUrl}
          />
        ) : null}
      </div>
      <SaveButton
        className="absolute top-3 right-3 left-auto"
        onToggleSaved={onToggleSaved}
        saved={saved}
        venueId={venue.id}
      />
      <div className="space-y-0.5 p-3">
        <h3 className="truncate text-sm leading-tight font-bold text-on-surface">{venue.name}</h3>
        <p className="flex items-center gap-1 truncate text-xs text-on-surface-variant">
          <Icon className="shrink-0" name="location_on" size={14} />
          <span className="truncate">{venue.destinationName}</span>
        </p>
      </div>
    </CardFrame>
  );
}
