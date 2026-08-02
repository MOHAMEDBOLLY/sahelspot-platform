import Image from "next/image";
import { CTAButton } from "@/components/ui/CTAButton";

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
 * Blocked on the Studio collections model — API_REQUIREMENTS.md §2. */
export function FeatureCard({
  eyebrow,
  headline,
  body,
  imageUrl,
  ctaLabel,
  ctaHref,
}: FeatureCardProps) {
  return (
    <div className="relative aspect-[4/5] overflow-hidden rounded-3xl sm:aspect-video">
      {imageUrl ? (
        <Image alt={headline} className="object-cover" fill sizes="100vw" src={imageUrl} />
      ) : (
        <div className="h-full w-full bg-primary" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-primary/95 via-primary/30 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 space-y-2 p-6">
        <p className="text-xs font-bold tracking-wide text-tertiary uppercase">{eyebrow}</p>
        <h3 className="text-2xl font-black text-white">{headline}</h3>
        {body ? <p className="text-sm text-white/80">{body}</p> : null}
        <CTAButton href={ctaHref} icon="arrow_forward" iconPosition="trailing" variant="primary">
          {ctaLabel}
        </CTAButton>
      </div>
    </div>
  );
}
