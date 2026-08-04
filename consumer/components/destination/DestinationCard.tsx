import Image from "next/image";
import Link from "next/link";

type DestinationCardProps = {
  href: string;
  name: string;
  imageUrl: string | null;
  /** No API source today — API_REQUIREMENTS.md §3 (`venue_count`). */
  placeCount?: number | null;
  /** Approximate distance marker along the coastal road from Alexandria —
   * see `lib/home/destinationOrder.ts`. Editorial metadata, not a fact
   * about the venue count/rating hierarchy above it: deliberately smaller
   * and more muted than `placeCount`, so it reads as a subtle detail line,
   * never a badge or a second headline. */
  kilometerMarker?: number | null;
};

/** Home's Explore Destinations grid. `h-64 rounded-3xl`, gradient scrim,
 * bottom-left title + place count, `scale-110` hover on the image. Duration
 * was originally 700ms (read directly from the Home export) but that left
 * the image still zooming well after `.card-hover-lift`'s 300ms card-level
 * lift/shadow had already settled — shortened to 400ms so both motions
 * resolve together, per the post-launch hover design review. Zoom amount
 * and easing are untouched. */
export function DestinationCard({ href, name, imageUrl, placeCount, kilometerMarker }: DestinationCardProps) {
  return (
    <Link
      className="card-hover-lift group relative block h-64 overflow-hidden rounded-3xl shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
      href={href}
    >
      {imageUrl ? (
        <Image
          alt={name}
          className="object-cover transition-transform duration-[400ms] group-hover:scale-110"
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
        {kilometerMarker != null ? (
          <p className="text-xs font-medium text-white/70">KM {kilometerMarker}</p>
        ) : null}
        {placeCount != null ? (
          <p className="text-sm font-medium text-cream">{placeCount} Places</p>
        ) : null}
      </div>
    </Link>
  );
}
