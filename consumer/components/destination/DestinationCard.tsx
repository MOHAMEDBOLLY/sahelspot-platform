import Image from "next/image";
import { CardFrame } from "@/components/patterns/CardShell";

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

/** Home's Explore Destinations row. Card System Redesign (SAHELSPOT
 * CONSUMER — CARD SYSTEM REDESIGN ONLY): shares the same flat `CardFrame`
 * construction as `VenueCard`'s standard card — image, then content
 * directly below it, no floating overlap panel — with one deliberate
 * difference kept from the previous design: the content block is a navy
 * fill instead of white. That's the one place a whole content area is
 * navy, and it's a cheap, legible way to tell "this is a destination, not a
 * venue" apart at a glance without introducing a second accent color or a
 * different card shape. No save action: destinations aren't saveable.
 *
 * Visual Richness / Art Direction Pass, item 3 (Destination Carousel) —
 * scaled up from the standard venue card (`w-56`/`h-36` → `w-64`/`h-44`) so
 * this rail reads as the showcase moment the brief asks for, not a smaller
 * version of every other rail; same data, same card family, same `CardFrame`
 * shell, just given more presence. The flat navy fill becomes a subtle
 * top-to-bottom gradient (navy → a touch darker) for surface depth instead
 * of a single flat tone — still reads as "navy," just less poster-flat.
 *
 * The image hover-zoom (`group-hover:scale-110`, 400ms) is the approved
 * `hover-scale` system token (docs/consumer/DESIGN_SYSTEM.md §Motion) —
 * unchanged by this redesign. */
export function DestinationCard({ href, name, imageUrl, placeCount, kilometerMarker }: DestinationCardProps) {
  return (
    <CardFrame className="group w-64" href={href}>
      <div className="relative h-44 overflow-hidden bg-cream">
        {imageUrl ? (
          <Image
            alt={name}
            className="object-cover transition-transform duration-[400ms] group-hover:scale-110"
            fill
            sizes="256px"
            src={imageUrl}
          />
        ) : (
          <div className="h-full w-full bg-primary-container" />
        )}
      </div>
      <div
        className="space-y-1 p-4"
        style={{ background: "linear-gradient(165deg, var(--color-primary) 0%, #08263f 100%)" }}
      >
        <h3 className="truncate text-lg leading-tight font-bold tracking-tight text-white">{name}</h3>
        <div className="flex items-center gap-1.5">
          {kilometerMarker != null ? (
            <span className="text-xs font-medium text-accent">{kilometerMarker} km</span>
          ) : null}
          {placeCount != null ? (
            <span className="text-xs font-medium text-white/70">
              {kilometerMarker != null ? "· " : ""}
              {placeCount} Places
            </span>
          ) : null}
        </div>
      </div>
    </CardFrame>
  );
}
