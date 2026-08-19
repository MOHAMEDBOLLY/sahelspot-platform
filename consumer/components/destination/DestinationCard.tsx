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
 * Best Beaches' overlay, only the hue changes: this reuses the app's
 * existing `--color-primary` warm charcoal (`#2e2a25` / `rgb(46,42,37)`,
 * `app/globals.css`, COLOR SYSTEM V2 — was navy) — the same structural dark
 * every overlay/shadow in this app already uses — not a new or sampled
 * color. `href`
 * and all existing content (name, kilometer marker, place count) are
 * preserved unchanged; no save action, destinations still aren't saveable.
 *
 * The image hover-zoom (`md:group-hover:scale-110`, 400ms) is the approved
 * `hover-scale` system token (docs/consumer/DESIGN_SYSTEM.md §Motion). The
 * `md:` prefix scopes it to pointer-capable viewports so a tap on touch
 * cannot leave the image stuck zoomed via synthetic hover. */
export function DestinationCard({ href, name, imageUrl, placeCount, kilometerMarker }: DestinationCardProps) {
  return (
    // COASTAL EDITORIAL MIGRATION — the Coverflow's visual presence. Was
    // `w-52`/`h-32` (208x128), which measured 48px shorter than the Best
    // Beaches rail directly above it on Home and read as a smaller,
    // secondary moment rather than one of Home's major beats. `w-56`/`h-44`
    // (224x176) brings the Coverflow section to parity with Best Beaches,
    // matching the approved prototype. `DestinationCoverflow` measures the
    // rendered card via `ResizeObserver` rather than hard-coding a size, so
    // its perspective/rotation/spacing math adapts with no change of its
    // own. This component has exactly one call site (Home's Coverflow), so
    // the resize cannot affect any other surface.
    <CardFrame className="group w-56" href={href}>
      <div className="relative h-44 overflow-hidden bg-cream">
        {imageUrl ? (
          <Image
            alt={name}
            className="object-cover transition-transform duration-[400ms] md:group-hover:scale-110"
            fill
            sizes="224px"
            src={imageUrl}
          />
        ) : (
          <div className="h-full w-full bg-primary-container" />
        )}
        {/* Shared Editorial grammar overlay (`app/globals.css`) — was an
          * inline navy gradient duplicated here; the token now carries the
          * identical stops for every Editorial card. */}
        <div aria-hidden="true" className="editorial-overlay pointer-events-none absolute inset-0" />
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
