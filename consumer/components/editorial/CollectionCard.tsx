import Image from "next/image";
import Link from "next/link";
import { CornerAccent } from "@/components/venue/VenueCard";

type CollectionCardProps = {
  href: string;
  label: string;
  imageUrl: string | null;
};

/** Explore's 2x2 Collections bento grid. `h-40`, label only, no subtitle and
 * no place count — that's what distinguishes it from `DestinationCard`
 * beyond the height. Blocked on the Studio collections model,
 * docs/consumer/API_REQUIREMENTS.md §2.
 *
 * Inherits the shared SahelSpot Mobile 2027 card visual language — corner
 * radius, elevation, surface treatment (the floating inset panel), image
 * treatment, and the yellow corner accent — while staying a simpler,
 * independent component from `VenueCard`. Collections are not venues: no
 * save affordance, no rating, no location row, no second variant. Only the
 * interactive affordance that already existed (the link itself) remains —
 * see docs/consumer/MOBILE_2027_COMPONENT_MAPPING.md Approval Notes 3 & the
 * Stage 2 implementation notes: shared language, different responsibility,
 * never new functionality purely for visual consistency. */
export function CollectionCard({ href, label, imageUrl }: CollectionCardProps) {
  return (
    <Link
      className="block overflow-hidden rounded-3xl bg-surface-container-lowest shadow-md transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
      href={href}
    >
      <div className="relative h-40">
        {imageUrl ? (
          <Image alt={label} className="object-cover" fill sizes="50vw" src={imageUrl} />
        ) : (
          <div className="h-full w-full bg-primary-container" />
        )}
        <CornerAccent />
      </div>
      {/* Floating info panel, matching the card family's construction — here
       * holding only the label, since a collection has nothing else to
       * show. Lower information density than `VenueCard` is the point, not
       * a gap to fill. */}
      <div className="-mt-4 mx-3 rounded-2xl bg-surface-container-lowest p-3 shadow-sm">
        <span className="block truncate font-headline text-lg font-bold text-on-surface">
          {label}
        </span>
      </div>
    </Link>
  );
}
