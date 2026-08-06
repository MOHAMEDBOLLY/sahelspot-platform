import Image from "next/image";
import { CTAButton } from "@/components/ui/CTAButton";
import { CornerAccent } from "@/components/venue/VenueCard";

type FeatureCardProps = {
  eyebrow: string;
  headline: string;
  body?: string;
  imageUrl: string | null;
  ctaLabel: string;
  ctaHref: string;
};

/** Explore's Editor's Picks large feature card (`aspect-[4/5]` mobile) and the
 * Weekend Planner banner (`h-44`, no body text, white CTA pill) share this
 * shape closely enough to be one component with the caller controlling
 * aspect ratio and CTA variant.
 *
 * Blocked on the Studio collections model — API_REQUIREMENTS.md §2.
 *
 * Visual migration only (docs/consumer/MOBILE_2027_COMPONENT_MAPPING.md,
 * Stage 3) — API, props, behavior, and data flow are unchanged. Inherits the
 * shared card-family corner radius, elevation, typography, image treatment,
 * and the yellow corner accent (purely decorative — it carries no
 * functionality, unlike a save badge, so it's appropriate here even though
 * this component has no saved state). The gradient-scrim text-over-image
 * surface treatment is kept as-is rather than switched to the floating
 * white panel used elsewhere in the card family: that gradient treatment is
 * itself the frozen, canonical construction for this specific content type
 * (Editor's Picks / Weekend Planner), confirmed against the approved Explore
 * Stitch render — a dense eyebrow/headline/body/CTA stack doesn't fit the
 * floating-panel pattern used by simpler photo+label cards. No save badge:
 * this component has no real saved state, and a save affordance would imply
 * functionality that doesn't exist. */
export function FeatureCard({
  eyebrow,
  headline,
  body,
  imageUrl,
  ctaLabel,
  ctaHref,
}: FeatureCardProps) {
  return (
    <div className="relative aspect-[4/5] overflow-hidden rounded-3xl shadow-md sm:aspect-video">
      {imageUrl ? (
        <Image alt={headline} className="object-cover" fill sizes="100vw" src={imageUrl} />
      ) : (
        <div className="h-full w-full bg-primary" />
      )}
      <CornerAccent />
      <div className="absolute inset-0 bg-gradient-to-t from-primary/95 via-primary/30 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 space-y-2 p-6">
        <p className="text-xs font-bold tracking-wide text-accent uppercase">{eyebrow}</p>
        <h3 className="font-headline text-2xl font-bold text-white">{headline}</h3>
        {body ? <p className="text-sm text-white/80">{body}</p> : null}
        <CTAButton href={ctaHref} icon="arrow_forward" iconPosition="trailing" variant="primary">
          {ctaLabel}
        </CTAButton>
      </div>
    </div>
  );
}
