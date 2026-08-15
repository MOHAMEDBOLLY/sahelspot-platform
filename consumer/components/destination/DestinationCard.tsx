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

/** Home's Explore Destinations row. NIGHTLIFE + DESTINATIONS — CORRECT
 * SECTION COLORS: adapted from the prior "photo + solid navy content panel
 * below it" construction to the Best Beaches full-image architecture — the
 * photo now fills the *entire* card, a navy gradient overlays it directly
 * (transparent near the top, strong/opaque at the bottom), and the name/
 * km-marker/place-count content that used to live in the separate navy
 * panel now sits absolutely positioned over the darkest part of the overlay
 * instead — no separate content block remains. Same stop shape/alphas as
 * Best Beaches' terracotta overlay, only the hue changes: this reuses the
 * app's existing `--color-primary` navy (`#0d3b66` / `rgb(13,59,102)`,
 * `app/globals.css`) — the same navy the old content panel and every other
 * navy surface in this app already use — not a new or sampled color. `href`
 * and all existing content (name, kilometer marker, place count) are
 * preserved unchanged; no save action, destinations still aren't saveable.
 *
 * The image hover-zoom (`group-hover:scale-110`, 400ms) is the approved
 * `hover-scale` system token (docs/consumer/DESIGN_SYSTEM.md §Motion) —
 * unchanged by this pass. */
export function DestinationCard({ href, name, imageUrl, placeCount, kilometerMarker }: DestinationCardProps) {
  return (
    <CardFrame className="group w-52" href={href}>
      <div className="relative h-32 overflow-hidden bg-cream">
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
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(13,59,102,0)_20%,rgba(13,59,102,0.02)_35%,rgba(13,59,102,0.12)_48%,rgba(13,59,102,0.38)_62%,rgba(13,59,102,0.82)_78%,rgba(13,59,102,1)_100%)]"
        />
        <div className="absolute inset-x-3 bottom-3 z-10">
          <h3 className="truncate text-sm leading-tight font-bold tracking-tight text-white drop-shadow-sm">
            {name}
          </h3>
          <div className="mt-0.5 flex items-center gap-1.5">
            {kilometerMarker != null ? (
              <span className="text-xs font-medium text-accent">{kilometerMarker} km</span>
            ) : null}
            {placeCount != null ? (
              <span className="text-xs font-medium text-white/85">
                {kilometerMarker != null ? "· " : ""}
                {placeCount} Places
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </CardFrame>
  );
}
