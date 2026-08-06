import Image from "next/image";
import { SignatureCard, OverlapPanel } from "@/components/venue/VenueCard";

type DestinationCardProps = {
  href: string;
  name: string;
  imageUrl: string | null;
  /** No API source today — API_REQUIREMENTS.md §3 (`venue_count`). This is a
   * documented, approved product field (docs/consumer/STITCH_SOURCE.md §Place
   * count per destination), not a deprecated one — its absence from the
   * canonical Stitch export's static markup only reflects that the export
   * has no real backend data to render, not that the feature was removed by
   * decision. Rendered whenever the caller has a value; renders nothing when
   * absent, same as every other optional field in this component family. */
  placeCount?: number | null;
  /** Approximate distance marker along the coastal road from Alexandria —
   * see `lib/home/destinationOrder.ts`. */
  kilometerMarker?: number | null;
};

/** Home's Explore Destinations row. Implemented pixel-faithfully against
 * the canonical Stitch export, sharing the exact same card shell
 * (`SignatureCard`/`OverlapPanel`) as `VenueCard`'s `vertical-lg` — same
 * sharp-top-right silhouette, same accent bracket, same overlap panel
 * construction, just the navy-fill panel tone the export uses for
 * destinations instead of venues' white/bordered tone, and no bookmark tab
 * (destinations aren't saveable).
 *
 * The image hover-zoom (`group-hover:scale-110`, 400ms) is the approved
 * `hover-scale` system token (docs/consumer/DESIGN_SYSTEM.md §Motion,
 * docs/consumer/ROADMAP.md) — a hover interaction can never appear in a
 * static Stitch export by definition, so its absence there was not evidence
 * of deprecation. Restored, not reinvented: this is the same 400ms duration
 * (shortened from the export's literal 700ms so the image's zoom and the
 * card's own tap/lift settle together) already reviewed and approved before
 * this migration. `prefers-reduced-motion` already suppresses it globally
 * via `app/globals.css`. */
export function DestinationCard({ href, name, imageUrl, placeCount, kilometerMarker }: DestinationCardProps) {
  return (
    <SignatureCard className="group w-56" href={href}>
      <div className="relative h-40 overflow-hidden bg-cream">
        {imageUrl ? (
          <Image
            alt={name}
            className="object-cover transition-transform duration-[400ms] group-hover:scale-110"
            fill
            sizes="224px"
            src={imageUrl}
          />
        ) : (
          <div className="h-full w-full bg-primary-container" />
        )}
      </div>
      <OverlapPanel tone="dark">
        <div className="flex flex-col">
          <h3 className="font-headline text-lg leading-tight font-bold text-white">{name}</h3>
          {kilometerMarker != null ? (
            <span className="mt-1 text-xs font-medium text-accent">{kilometerMarker} km</span>
          ) : null}
          {placeCount != null ? (
            <span className="text-xs font-medium text-white/70">{placeCount} Places</span>
          ) : null}
        </div>
      </OverlapPanel>
    </SignatureCard>
  );
}
