import Image from "next/image";
import { CardFrame, SaveButton } from "@/components/patterns/CardShell";
import { Icon } from "@/components/ui/Icon";
import type { Venue } from "@/lib/domain/venue";

type NightlifeCardProps = {
  venue: Venue;
  saved: boolean;
  onToggleSaved?: (venueId: string) => void;
};

/** Home's Nightlife rail ONLY (SAHELSPOT CONSUMER — NIGHTLIFE + DESTINATIONS
 * SECTION COLOR SYSTEM). Same fixed `w-[230px]` sizing as before, but now
 * follows the Best Beaches full-image architecture: the photo fills the
 * *entire* card (no separate content strip below it) with a deep violet
 * gradient overlaid directly on it, building from transparent near the top
 * to strong/opaque at the bottom, and title/location sit absolutely
 * positioned over the darkest part of the overlay. Same section-color
 * pattern as Best Beaches' terracotta — only the hue differs
 * (`rgb(91,42,131)` / `#5B2A83`, sampled from the section-color reference's
 * deep purple/violet). No category badge here — Nightlife never had one
 * before this pass, and the brief is explicit about not introducing new
 * decorative elements.
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
        {/* Same stop shape/alphas as Best Beaches' terracotta overlay
          * (transparent to 20%, opaque by 100%) — only the hue changes. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(91,42,131,0)_20%,rgba(91,42,131,0.02)_35%,rgba(91,42,131,0.12)_48%,rgba(91,42,131,0.38)_62%,rgba(91,42,131,0.82)_78%,rgba(91,42,131,1)_100%)]"
        />
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
