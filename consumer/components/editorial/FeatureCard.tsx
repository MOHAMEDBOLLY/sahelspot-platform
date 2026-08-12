import Image from "next/image";
import { CTAButton } from "@/components/ui/CTAButton";
import { LBracketAccent } from "@/components/patterns/CardShell";

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
 * Card System Completion (SAHELSPOT CONSUMER — CARD SYSTEM COMPLETION):
 * brought onto the current card family's frame language — `rounded-3xl
 * rounded-tr-none`, the matching `border-outline-variant/10` hairline, and
 * `LBracketAccent` (lime) in place of the old flat-triangle `CornerAccent` —
 * without reusing `CardFrame` itself. `CardFrame` renders the whole card as
 * one `<Link>`, but here only the `CTAButton` navigates (`ctaHref`); the
 * card root is a plain `<div>` so the image can fill the whole surface while
 * the CTA stays the one real link. Wrapping this in `CardFrame` would nest
 * an `<a>` inside the `CTAButton`'s own `<a>` — invalid HTML that breaks
 * click handling — so the frame styling is applied directly instead. API,
 * props, behavior, and data flow are unchanged.
 *
 * The gradient-scrim text-over-image surface treatment is kept as-is rather
 * than switched to the flat image-then-content layout used elsewhere in the
 * card family: a dense eyebrow/headline/body/CTA stack doesn't fit that
 * pattern, and this remains a deliberately more editorial component, not a
 * copy of the standard venue card. No save action: this component has no
 * real saved state, and a save affordance would imply functionality that
 * doesn't exist. */
export function FeatureCard({
  eyebrow,
  headline,
  body,
  imageUrl,
  ctaLabel,
  ctaHref,
}: FeatureCardProps) {
  return (
    <div className="relative aspect-[4/5] overflow-hidden rounded-3xl rounded-tr-none border border-outline-variant/10 shadow-sm sm:aspect-video">
      {imageUrl ? (
        <Image alt={headline} className="object-cover" fill sizes="100vw" src={imageUrl} />
      ) : (
        <div className="h-full w-full bg-primary" />
      )}
      <LBracketAccent size="lg" />
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
