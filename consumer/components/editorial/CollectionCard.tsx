import Image from "next/image";
import Link from "next/link";

type CollectionCardProps = {
  href: string;
  label: string;
  imageUrl: string | null;
};

/** Explore's 2x2 Collections bento grid. `h-40`, gradient + label only, no
 * subtitle and no place count — that's what distinguishes it from
 * `DestinationCard` beyond the height. Blocked on the Studio collections
 * model, docs/consumer/API_REQUIREMENTS.md §2. */
export function CollectionCard({ href, label, imageUrl }: CollectionCardProps) {
  return (
    <Link className="relative block h-40 overflow-hidden rounded-3xl" href={href}>
      {imageUrl ? (
        <Image alt={label} className="object-cover" fill sizes="50vw" src={imageUrl} />
      ) : (
        <div className="h-full w-full bg-primary-container" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/10 to-transparent" />
      <span className="absolute bottom-3 left-3 text-lg font-black text-white">{label}</span>
    </Link>
  );
}
