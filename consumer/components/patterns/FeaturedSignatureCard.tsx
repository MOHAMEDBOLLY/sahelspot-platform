import Image from "next/image";
import { Icon } from "@/components/ui/Icon";
import { Pill } from "@/components/ui/Pill";
import { RatingBadge } from "@/components/ui/RatingBadge";
import { CardFrame, SaveButton } from "@/components/patterns/CardShell";

type FeaturedSignatureCardProps = {
  href: string;
  imageUrl: string | null;
  title: string;
  locationLabel?: string | null;
  /** Small label over the image ("Beach Club", "This weekend", ...) — reuses
   * `Pill`'s existing `counter` treatment (translucent black over imagery)
   * by default, and specifically not lime: `--color-accent` is reserved for
   * the single structural highlight (save, filter, "See All"), never a
   * decorative label. */
  chipLabel?: string | null;
  /** `"coral"` is Events-only, per the brief's explicit "small date badge,
   * not the whole card" rule: a small solid-coral chip instead of the
   * default translucent-black one, and *only* the chip — the rest of the
   * card (image treatment, frame, L-Bracket) is identical to every other
   * `FeaturedSignatureCard`. Coral never appears anywhere else in this
   * component. */
  chipTone?: "neutral" | "coral";
  rating?: number | null;
  reviewCount?: number | null;
  saveable?: {
    id: string;
    saved: boolean;
    onToggleSaved: (id: string) => void;
  };
  className?: string;
};

/** Featured variant of the one card family — Card System Redesign
 * (SAHELSPOT CONSUMER — CARD SYSTEM REDESIGN ONLY). Composes the same
 * `CardFrame`/`SaveButton` primitives the standard card now uses, at a
 * larger scale (taller image, bigger title, editorial gradient-overlay
 * treatment) so it reads as genuinely more important — not just a bigger
 * copy of the standard card. Deliberately never used to replace
 * `CardFrame`'s L-Bracket or the family's shared radius/press/shadow
 * language: "featured" changes emphasis, not which card family it belongs
 * to.
 *
 * Used selectively — the lead card in the Best Beaches and Upcoming Events
 * rails only (`HomeClient.tsx`) — not a wholesale card replacement. No
 * glassmorphism, glow, 3D transform, or novelty shadow: the gradient is the
 * same `.hero-gradient` token `ImageGallery`/`HomeHero` already use, and the
 * chip is an existing `Pill` variant. */
export function FeaturedSignatureCard({
  href,
  imageUrl,
  title,
  locationLabel,
  chipLabel,
  chipTone = "neutral",
  rating,
  reviewCount,
  saveable,
  className = "",
}: FeaturedSignatureCardProps) {
  return (
    <CardFrame className={`group w-72 ${className}`} href={href}>
      <div className="relative h-64 overflow-hidden bg-cream">
        {imageUrl ? (
          // Same approved `hover-scale` token `DestinationCard` already uses
          // (400ms, group-hover) — reused, not a new motion invented for
          // this variant.
          <Image
            alt={title}
            className="object-cover transition-transform duration-[400ms] group-hover:scale-110"
            fill
            sizes="288px"
            src={imageUrl}
          />
        ) : null}
        <div aria-hidden="true" className="hero-gradient absolute inset-0" />
        {saveable ? (
          <SaveButton
            onToggleSaved={saveable.onToggleSaved}
            saved={saveable.saved}
            venueId={saveable.id}
          />
        ) : null}
        {chipLabel ? (
          <span className="absolute top-3 right-3">
            {chipTone === "coral" ? (
              <span className="inline-flex items-center rounded-full bg-coral px-2.5 py-1 text-xs font-semibold text-white">
                {chipLabel}
              </span>
            ) : (
              <Pill variant="counter">{chipLabel}</Pill>
            )}
          </span>
        ) : null}
        <div className="absolute inset-x-4 bottom-4">
          <h3 className="font-headline text-2xl leading-tight font-bold text-white drop-shadow-sm">
            {title}
          </h3>
          {locationLabel ? (
            <p className="mt-0.5 flex items-center gap-1 text-sm font-medium text-white/85">
              <Icon size={16} name="location_on" />
              {locationLabel}
            </p>
          ) : null}
        </div>
      </div>
      {/* Flat content row, not a floating overlap panel — same construction
        * change as the standard card. Omitted entirely when there's no
        * rating (an event), matching `VenueCard`'s "omit what has no data"
        * pattern rather than rendering an empty row. */}
      {rating != null ? (
        <div className="p-3">
          <RatingBadge reviewCount={reviewCount ?? undefined} value={rating} />
        </div>
      ) : null}
    </CardFrame>
  );
}
