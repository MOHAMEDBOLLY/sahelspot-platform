import Image from "next/image";
import { CardFrame } from "@/components/patterns/CardShell";

type CollectionCardProps = {
  href: string;
  label: string;
  imageUrl: string | null;
};

/** Explore's 2x2 Collections bento grid. `h-36`, label only, no subtitle and
 * no place count — that's what distinguishes it from `DestinationCard`
 * beyond the height. Blocked on the Studio collections model,
 * docs/consumer/API_REQUIREMENTS.md §2.
 *
 * Card System Redesign (SAHELSPOT CONSUMER — CARD SYSTEM REDESIGN ONLY):
 * now shares `CardFrame` directly, which also brings this card onto
 * `LBracketAccent` (lime) instead of the older flat-triangle `CornerAccent`
 * it used before — one less divergent corner treatment in the family.
 * Collections are not venues: no save affordance, no rating, no location
 * row, no second variant — only the interactive affordance that already
 * existed (the link itself) remains, per
 * docs/consumer/MOBILE_2027_COMPONENT_MAPPING.md Approval Notes 3. */
export function CollectionCard({ href, label, imageUrl }: CollectionCardProps) {
  return (
    <CardFrame className="w-full" href={href}>
      <div className="relative h-36 overflow-hidden bg-cream">
        {imageUrl ? (
          <Image alt={label} className="object-cover" fill sizes="50vw" src={imageUrl} />
        ) : (
          <div className="h-full w-full bg-primary-container" />
        )}
      </div>
      <div className="p-3">
        <span className="block truncate text-base font-bold text-on-surface">{label}</span>
      </div>
    </CardFrame>
  );
}
