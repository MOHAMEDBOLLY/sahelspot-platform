import Image from "next/image";
import { CardFrame, SaveButton } from "@/components/patterns/CardShell";
import { Icon } from "@/components/ui/Icon";
import type { Venue } from "@/lib/domain/venue";

type NightlifeCardProps = {
  venue: Venue;
  saved: boolean;
  onToggleSaved?: (venueId: string) => void;
};

/** Home's Nightlife rail ONLY. Same fixed `w-[230px]` sizing and the same
 * full-image architecture as before: the photo fills the *entire* card (no
 * separate content strip below it), an overlay builds from transparent near
 * the top to opaque at the bottom, and title/location sit absolutely
 * positioned over the darkest part of it.
 *
 * COASTAL EDITORIAL MIGRATION — this card's own deep-violet overlay
 * (`rgb(91,42,131)`) is replaced by the shared `.editorial-overlay` token
 * (navy, `app/globals.css`). The violet was a per-section invention with no
 * system-level justification, and having Nightlife, Best Beaches, and
 * Destinations each carry a different hue for the same visual idea was the
 * card system's main documented inconsistency. Nothing else about this
 * component changes: same width, same image height, same content, same
 * absence of a category badge.
 *
 * Home-only: does not touch `VenueCard`, and does not change how Nightlife
 * venues render anywhere else (Search, Venue Details, ...). */
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
        <div aria-hidden="true" className="editorial-overlay pointer-events-none absolute inset-0" />
        <SaveButton
          className="absolute top-3 right-3 left-auto"
          onToggleSaved={onToggleSaved}
          saved={saved}
          venueId={venue.id}
        />
        <div className="absolute inset-x-3 bottom-3 z-10">
          <h3 className="truncate text-sm leading-tight font-bold text-white drop-shadow-sm">{venue.name}</h3>
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs font-medium text-white/85">
            <Icon className="shrink-0" name="location_on" size={14} />
            <span className="truncate">{venue.destinationName}</span>
          </p>
        </div>
      </div>
    </CardFrame>
  );
}
