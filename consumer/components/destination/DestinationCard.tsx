import Image from "next/image";
import Link from "next/link";

type DestinationCardProps = {
  href: string;
  name: string;
  imageUrl: string | null;
  /** No API source today — API_REQUIREMENTS.md §3 (`venue_count`). */
  placeCount?: number | null;
};

/** Home's Explore Destinations grid. `h-64 rounded-3xl`, gradient scrim,
 * bottom-left title + place count, `scale-110` hover on the image over 700ms —
 * read directly from the Home export. */
export function DestinationCard({ href, name, imageUrl, placeCount }: DestinationCardProps) {
  return (
    <Link
      className="group relative block h-64 overflow-hidden rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
      href={href}
    >
      {imageUrl ? (
        <Image
          alt={name}
          className="object-cover transition-transform duration-700 group-hover:scale-110"
          fill
          sizes="50vw"
          src={imageUrl}
        />
      ) : (
        <div className="h-full w-full bg-primary-container" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/20 to-transparent" />
      <div className="absolute bottom-4 left-4">
        <h3 className="text-xl font-black tracking-tight text-white">{name}</h3>
        {placeCount != null ? (
          <p className="text-sm font-medium text-cream">{placeCount} Places</p>
        ) : null}
      </div>
    </Link>
  );
}
