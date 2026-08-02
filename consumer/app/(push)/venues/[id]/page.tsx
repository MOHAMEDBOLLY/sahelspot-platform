"use client";

import { notFound, useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ChecklistRow } from "@/components/patterns/ChecklistRow";
import { EmptyState } from "@/components/patterns/EmptyState";
import { InfoPill } from "@/components/patterns/InfoPill";
import { SectionHeader } from "@/components/patterns/SectionHeader";
import { CTAButton } from "@/components/ui/CTAButton";
import { IconActionButton } from "@/components/ui/IconActionButton";
import { Pill } from "@/components/ui/Pill";
import { RatingStars } from "@/components/ui/RatingStars";
import { Skeleton } from "@/components/ui/Skeleton";
import { GalleryThumbnails } from "@/components/venue/GalleryThumbnails";
import { ImageGallery } from "@/components/venue/ImageGallery";
import { useVenue } from "@/lib/hooks/useVenue";
import { useSaved } from "@/lib/saved/useSaved";
import { VENUE_CATEGORY_LABEL } from "@/lib/domain/venueCategoryLabel";

/** WhatsApp's brand SVG — the one place a brand mark overrides the icon
 * system, confirmed in the Boca Beach export (`#25D366`, not a Material
 * Symbol). */
function WhatsAppIcon() {
  return (
    <svg className="h-6 w-6 fill-current text-whatsapp" viewBox="0 0 24 24">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

/** Venue Details — Boca Beach in the export, `/Users/Nabil/Downloads/stitch_sahelspot 2/`.
 *
 * Section spacing here is `space-y-6` (24px) and the container is `max-w-md`,
 * both distinct from the root screens' `space-y-8`/`max-w-7xl` — confirmed in
 * the export, not a normalization. Padding is `px-4`, correcting the export's
 * off-grid `px-5`. No bottom nav (approved decision 6) — the export shows one
 * with *Explore* marked active on a venue page, an outright Stitch bug. */
export default function VenueDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const venue = useVenue(params.id);
  const { isSaved, toggle } = useSaved();
  const [shareState, setShareState] = useState<"idle" | "copied">("idle");

  if (venue.isLoading) {
    return (
      <div className="mx-auto max-w-md space-y-6 pb-12">
        <Skeleton className="h-80 w-full rounded-none" />
        <div className="space-y-6 px-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (venue.isError) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4">
        <EmptyState
          action={
            <CTAButton onClick={() => venue.refetch()} variant="secondary">
              Retry
            </CTAButton>
          }
          description="We couldn't reach SahelSpot Studio. Check your connection and try again."
          icon="error_outline"
          title="Something went wrong"
        />
      </div>
    );
  }

  if (!venue.data) {
    notFound();
  }

  const data = venue.data;
  const images = [data.coverImageUrl, ...data.galleryImageUrls].filter(
    (url): url is string => url !== null,
  );
  const tags = [VENUE_CATEGORY_LABEL[data.category], ...data.tags];
  const infoPills = [
    data.priceRange ? { icon: "payments", label: data.priceRange } : null,
    data.distanceLabel ? { icon: "distance", label: data.distanceLabel } : null,
    ...data.amenities.map((amenity) => ({ icon: "check_circle", label: amenity })),
  ].filter((pill): pill is { icon: string; label: string } => pill !== null);

  async function handleShare() {
    const shareData = { title: data.name, url: window.location.href };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // User cancelled — not an error.
      }
      return;
    }
    await navigator.clipboard.writeText(window.location.href);
    setShareState("copied");
    setTimeout(() => setShareState("idle"), 2000);
  }

  return (
    <div className="mx-auto max-w-md pb-12">
      <ImageGallery
        onBack={() => router.back()}
        onShare={handleShare}
        onToggleSaved={() => toggle(data.id)}
        saved={isSaved(data.id)}
        venueName={data.name}
        images={images}
      />
      {shareState === "copied" ? (
        <p aria-live="polite" className="px-4 pt-2 text-center text-xs text-secondary">
          Link copied to clipboard
        </p>
      ) : null}

      <div className="space-y-6 px-4 pt-6">
        <header className="space-y-2">
          <div>
            <h1 className="text-3xl leading-none font-black tracking-tight text-primary">
              {data.name}
            </h1>
            <p className="mt-1 font-medium text-on-surface-variant">
              {data.destinationName}
            </p>
          </div>
          {/* No rating source yet (API_REQUIREMENTS.md §1) — omitted rather
            * than fabricated. A real 4.8 would render RatingStars exactly as
            * the export shows it once Studio delivers the field. */}
          {data.rating !== null ? (
            <RatingStars reviewCount={data.reviewCount ?? undefined} value={data.rating} />
          ) : null}
          <div className="flex gap-2">
            {tags.map((tag) => (
              <Pill key={tag} variant="tag">
                {tag}
              </Pill>
            ))}
          </div>
        </header>

        {infoPills.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {infoPills.map((pill) => (
              <InfoPill icon={pill.icon} key={pill.label} label={pill.label} />
            ))}
          </div>
        ) : null}

        {/* Every action here reflects a real contact field or omits itself —
          * none renders inert. A venue missing maps_url/phone/whatsapp/website
          * simply doesn't get that control, rather than a disabled one. */}
        {data.contact.mapsUrl || data.contact.phone || data.contact.whatsapp || data.contact.website ? (
          <div className="flex items-center gap-3">
            {data.contact.mapsUrl ? (
              <CTAButton className="flex-grow" href={data.contact.mapsUrl} icon="directions">
                Directions
              </CTAButton>
            ) : null}
            <div className="flex gap-2">
              {data.contact.phone ? (
                <IconActionButton href={`tel:${data.contact.phone}`} icon="call" label="Call" />
              ) : null}
              {data.contact.whatsapp ? (
                <IconActionButton
                  href={`https://wa.me/${data.contact.whatsapp}`}
                  label="Message on WhatsApp"
                >
                  <WhatsAppIcon />
                </IconActionButton>
              ) : null}
              {data.contact.website ? (
                <IconActionButton href={data.contact.website} icon="language" label="Visit website" />
              ) : null}
            </div>
          </div>
        ) : null}

        {/* "Why visit?" — no highlights source yet (API_REQUIREMENTS.md §8),
          * so the section is omitted entirely rather than showing invented
          * checklist copy. */}
        {data.highlights.length > 0 ? (
          <section className="space-y-4">
            <SectionHeader size="lg" title="Why visit?" />
            <div className="grid grid-cols-1 gap-3">
              {data.highlights.map((highlight) => (
                <ChecklistRow key={highlight} text={highlight} />
              ))}
            </div>
          </section>
        ) : null}

        {images.length > 0 ? (
          <section className="space-y-4">
            <SectionHeader size="lg" title="Gallery" />
            <GalleryThumbnails images={images} venueName={data.name} />
          </section>
        ) : null}

        {/* "Nearby Places" is omitted entirely — the Public API has no real
          * nearby-venue endpoint yet (API_REQUIREMENTS.md §4). Filtering the
          * already-fetched venue list by shared destination was an
          * approximation computed in the UI layer, not real nearby data, so
          * it's removed rather than kept as a stand-in. */}
      </div>
    </div>
  );
}
