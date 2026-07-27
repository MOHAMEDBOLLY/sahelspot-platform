import Link from "next/link";
import type { PublishedVenue } from "@/lib/types";

type VenueCardProps = {
  venue: PublishedVenue;
};

/** Extracted from `FeaturedVenues` in M8 — search results (M8) need the
 * exact same card, which is the actual cross-feature reuse `FeaturedVenues`
 * itself deferred extracting one for back in M3. */
export function VenueCard({ venue }: VenueCardProps) {
  return (
    <Link
      href={`/venues/${venue.id}`}
      className="overflow-hidden rounded-lg border border-gray-200 transition-colors hover:border-gray-300"
    >
      <div className="aspect-video bg-gray-100" />
      <div className="p-4">
        <p className="font-medium text-gray-900">{venue.name}</p>
        <p className="text-sm text-gray-500">
          {venue.category} · {venue.destination.name}
        </p>
      </div>
    </Link>
  );
}
