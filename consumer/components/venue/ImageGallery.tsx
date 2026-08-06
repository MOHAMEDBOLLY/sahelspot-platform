"use client";

import Image from "next/image";
import { useState } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { Pill } from "@/components/ui/Pill";

type ImageGalleryProps = {
  images: string[];
  venueName: string;
  onBack?: () => void;
  onShare?: () => void;
  saved: boolean;
  onToggleSaved: () => void;
};

/** Venue Details hero: full-bleed h-80 image with hero-gradient, back FAB
 * top-left, share + save FAB pair top-right, "n/total" counter bottom-right —
 * all read directly from the Boca Beach export.
 *
 * The thumbnail strip (w-32 h-32 rounded-2xl) is a separate, simpler piece
 * rendered by the page below the hero; this component owns only the hero
 * carousel and its controls, since that's the piece with real interaction
 * (position, back/share/save). */
export function ImageGallery({
  images,
  venueName,
  onBack,
  onShare,
  saved,
  onToggleSaved,
}: ImageGalleryProps) {
  const [index] = useState(0);
  const total = images.length;

  return (
    <section className="relative h-80 w-full overflow-hidden">
      {images[index] ? (
        <Image
          alt={venueName}
          className="object-cover"
          fill
          priority
          sizes="100vw"
          src={images[index]}
        />
      ) : (
        <div className="h-full w-full bg-cream" />
      )}
      <div className="hero-gradient absolute inset-0" />

      <div className="absolute top-4 left-4">
        <IconButton icon="arrow_back" label="Go back" onClick={onBack} variant="solid" />
      </div>
      <div className="absolute top-4 right-4 flex gap-2">
        <IconButton icon="share" label="Share this place" onClick={onShare} variant="solid" />
        <IconButton
          className={saved ? "text-accent" : undefined}
          filled={saved}
          icon="favorite"
          label={saved ? "Remove from saved" : "Save this place"}
          onClick={onToggleSaved}
          variant="solid"
        />
      </div>

      {total > 0 ? (
        <div className="absolute right-4 bottom-4">
          <Pill variant="counter">
            {index + 1}/{total}
          </Pill>
        </div>
      ) : null}
    </section>
  );
}
