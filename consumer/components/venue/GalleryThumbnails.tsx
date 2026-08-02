import Image from "next/image";

type GalleryThumbnailsProps = {
  images: string[];
  venueName: string;
};

/** The scrolling thumbnail strip under Venue Details' "Gallery" section
 * header — `w-32 h-32 rounded-2xl shadow-sm`, per the Boca Beach export. */
export function GalleryThumbnails({ images, venueName }: GalleryThumbnailsProps) {
  return (
    <div className="hide-scrollbar flex gap-3 overflow-x-auto">
      {images.map((src, index) => (
        <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-2xl shadow-sm" key={src}>
          <Image
            alt={`${venueName} — photo ${index + 1}`}
            className="object-cover"
            fill
            sizes="128px"
            src={src}
          />
        </div>
      ))}
    </div>
  );
}
