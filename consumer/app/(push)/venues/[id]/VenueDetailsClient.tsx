"use client";

import { notFound, useRouter } from "next/navigation";
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
import { VenueCard } from "@/components/venue/VenueCard";
import { useVenue } from "@/lib/hooks/useVenue";
import { useVenues } from "@/lib/hooks/useVenues";
import { useDestinations } from "@/lib/hooks/useDestinations";
import { useSaved } from "@/lib/saved/useSaved";
import { VENUE_CATEGORY_LABEL } from "@/lib/domain/venueCategoryLabel";
import { formatOpenUntil } from "@/lib/domain/openingHours";
import { distanceKm } from "@/lib/domain/geo";
import { ACCESS_TYPE_ICON, type AccessType } from "@/lib/domain/accessType";
import { areaLabel } from "@/lib/domain/destination";
import type { Venue } from "@/lib/domain/venue";

/** Same-destination venues ordered by real distance from `venue` — both
 * this venue and the candidate need real coordinates to compute one;
 * candidates without them are dropped rather than shown unordered. */
function nearbyVenues(venue: Venue, allVenues: Venue[], limit: number): Venue[] {
  if (!venue.coordinates) return [];
  const origin = venue.coordinates;
  return allVenues
    .filter((candidate) => candidate.id !== venue.id && candidate.destinationId === venue.destinationId)
    .flatMap((candidate) => (candidate.coordinates ? [{ candidate, km: distanceKm(origin, candidate.coordinates) }] : []))
    .sort((a, b) => a.km - b.km)
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}

/** Category/Tags/Access Type/Badges/Collections architecture (Phase 2) —
 * "Similar Experiences": venues sharing at least one tag with `venue`,
 * most shared tags first, a second and independent "you might also like"
 * axis alongside `nearbyVenues`'s distance-within-destination one. A venue
 * with no tags has no basis for this section (an empty overlap isn't a
 * recommendation), so it's omitted rather than falling back to something
 * unrelated. `exclude` keeps this additive to Nearby Places instead of
 * repeating the same cards under a second heading. */
function similarVenues(
  venue: Venue,
  allVenues: Venue[],
  exclude: ReadonlySet<string>,
  limit: number,
): Venue[] {
  if (venue.tags.length === 0) return [];
  const venueTags = new Set(venue.tags);
  return allVenues
    .filter((candidate) => candidate.id !== venue.id && !exclude.has(candidate.id))
    .map((candidate) => ({
      candidate,
      sharedTagCount: candidate.tags.filter((tag) => venueTags.has(tag)).length,
    }))
    .filter(({ sharedTagCount }) => sharedTagCount > 0)
    .sort((a, b) => b.sharedTagCount - a.sharedTagCount)
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}

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
 * with *Explore* marked active on a venue page, an outright Stitch bug.
 *
 * `venueId` arrives as a prop, not via `useParams`, because the route's
 * `page.tsx` is now a Server Component (so it can export `generateMetadata`
 * and read the same id) that renders this client component underneath it. */
export function VenueDetailsClient({ venueId }: { venueId: string }) {
  const router = useRouter();
  const venue = useVenue(venueId);
  const allVenues = useVenues();
  const destinations = useDestinations();
  const { isSaved, toggle } = useSaved();
  const [shareState, setShareState] = useState<"idle" | "copied" | "error">("idle");

  if (venue.isLoading) {
    return (
      <div className="mx-auto max-w-md space-y-6 pb-12">
        <Skeleton className="h-80 w-full rounded-none" />
        <div className="space-y-6 px-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-5 w-1/3" />
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-7 w-20 rounded-full" />
              <Skeleton className="h-7 w-24 rounded-full" />
            </div>
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-9 w-24 rounded-full" />
            <Skeleton className="h-9 w-24 rounded-full" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 flex-grow rounded-full" />
            <Skeleton className="h-12 w-12 rounded-full" />
            <Skeleton className="h-12 w-12 rounded-full" />
          </div>
          <Skeleton className="h-40 w-full" />
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
  const nearby = nearbyVenues(data, allVenues.data ?? [], 6);
  const similar = similarVenues(
    data,
    allVenues.data ?? [],
    new Set([data.id, ...nearby.map((venue) => venue.id)]),
    6,
  );
  // Location Context Label refinement — this venue's own destination is the
  // implicit "Destination context" for both lists below. `nearbyVenues`
  // already restricts candidates to the same `destinationId` (see its own
  // docstring), so `areaLabel` always resolves `null` there — Case 1 is
  // guaranteed by construction, not re-checked here. `similarVenues` has no
  // such restriction (tag-based, catalog-wide), so it's the one place this
  // can genuinely resolve to a real "X Area" badge.
  const destinationContext = (destinations.data ?? []).find((d) => d.id === data.destinationId) ?? null;
  const hoursLabel = data.openingHours ? formatOpenUntil(data.openingHours, new Date()) : null;
  // Access Type/Reservation Policy — Category/Tags/Access Type/Badges/
  // Collections architecture (Phase 1). Rendered as info pills alongside
  // hours/price/distance/amenities — same row, same treatment, no new
  // visual language: whether a place needs a QR code or a reservation is
  // exactly the kind of practical, scannable fact this row already exists
  // for. `accessType` is looked up in `ACCESS_TYPE_ICON` (a closed,
  // backend-defined vocabulary — see lib/domain/accessType.ts); an
  // unrecognized value still renders with a generic fallback icon rather
  // than being dropped, since a raw Studio value is more useful shown than
  // hidden.
  const accessTypeIcon = data.accessType
    ? (ACCESS_TYPE_ICON[data.accessType as AccessType] ?? "info")
    : null;
  const infoPills = [
    // Only rendered while genuinely open — see formatOpenUntil's own note on
    // why there's no "closed, opens at X" fallback copy to show instead.
    hoursLabel ? { icon: "schedule", label: hoursLabel } : null,
    data.priceRange ? { icon: "payments", label: data.priceRange } : null,
    data.distanceLabel ? { icon: "distance", label: data.distanceLabel } : null,
    data.accessType ? { icon: accessTypeIcon!, label: data.accessType } : null,
    data.reservationPolicy
      ? { icon: "event_available", label: `Reservation ${data.reservationPolicy}` }
      : null,
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
    // Clipboard fallback: `navigator.clipboard` can be absent (unsupported
    // browser) and `writeText` can reject (permission denied) — both are
    // real, expected outcomes here, not exceptional ones, so both surface
    // the same user-visible failure state rather than an unhandled
    // rejection or a silent no-op. Same fix as More's `handleShare`.
    try {
      if (!navigator.clipboard) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(window.location.href);
      setShareState("copied");
    } catch {
      setShareState("error");
    } finally {
      setTimeout(() => setShareState("idle"), 2000);
    }
  }

  // JSON-LD from real fields only — no invented address/phone/rating.
  // Rendered client-side (this component only ever has data after the
  // client fetch resolves), which is a real limitation for crawlers that
  // don't execute JS; see ROADMAP.md's Phase 11 note.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TouristAttraction",
    name: data.name,
    ...(data.shortDescription ? { description: data.shortDescription } : {}),
    ...(data.coverImageUrl ? { image: data.coverImageUrl } : {}),
    address: { "@type": "PostalAddress", addressRegion: data.destinationName, addressCountry: "EG" },
    ...(data.contact.phone ? { telephone: data.contact.phone } : {}),
    ...(data.contact.website ? { url: data.contact.website } : {}),
  };

  return (
    <div className="mx-auto max-w-md pb-12">
      {/* eslint-disable-next-line react/no-danger -- JSON-LD requires a raw script tag.
        * `</` is escaped defensively — editorial text (short_description) is
        * trusted content, but there's no reason to let it break out of the
        * script tag if it ever contained a literal "</script>". */}
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/<\//g, "<\\/") }}
        type="application/ld+json"
      />
      <ImageGallery
        onBack={() => router.back()}
        onShare={handleShare}
        onToggleSaved={() => toggle(data.id)}
        saved={isSaved(data.id)}
        venueName={data.name}
        images={images}
      />
      {shareState === "copied" ? (
        <p aria-live="polite" className="px-4 pt-2 text-center text-xs text-on-surface-variant">
          Link copied to clipboard
        </p>
      ) : shareState === "error" ? (
        <p aria-live="polite" className="px-4 pt-2 text-center text-xs text-error">
          Couldn&apos;t copy the link. Please copy it from the address bar instead.
        </p>
      ) : null}

      <div className="space-y-6 px-4 pt-6">
        <header className="space-y-2">
          <div>
            <h1 className="font-headline text-3xl leading-none font-bold tracking-tight text-primary">
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
          <div className="hide-scrollbar flex gap-3 overflow-x-auto pb-2">
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

        {/* Phase 1 — Gallery hasn't launched yet, so a venue with only a
          * cover image and no real gallery isn't "a gallery of one photo,"
          * it's no gallery at all: `images` (used above for the hero
          * swiper) always includes the cover, so gating on it would show a
          * "Gallery" section whose only content duplicates the hero.
          * Gated on `galleryImageUrls` specifically instead — genuine
          * gallery content, independent of whether a cover exists. Support
          * for the section itself is unchanged; it simply doesn't render
          * until real gallery images exist. */}
        {data.galleryImageUrls.length > 0 ? (
          <section className="space-y-4">
            <SectionHeader size="lg" title="Gallery" />
            <GalleryThumbnails images={images} venueName={data.name} />
          </section>
        ) : null}

        {/* Same-destination venues ordered by real distance — computed from
          * both venues' real coordinates (`lib/domain/geo.ts`), not a
          * fabricated or unordered approximation. Needs `data.coordinates`
          * and at least one same-destination venue with coordinates of its
          * own; omitted rather than shown empty or unordered otherwise. */}
        {nearby.length > 0 ? (
          <section className="space-y-4">
            <SectionHeader size="lg" title="Nearby Places" />
            <div className="space-y-3">
              {nearby.map((nearbyVenue) => (
                <VenueCard
                  areaLabel={areaLabel(nearbyVenue.destinationId, destinationContext, destinations.data ?? [])}
                  key={nearbyVenue.id}
                  onToggleSaved={toggle}
                  saved={isSaved(nearbyVenue.id)}
                  variant="horizontal-row"
                  venue={nearbyVenue}
                />
              ))}
            </div>
          </section>
        ) : null}

        {similar.length > 0 ? (
          <section className="space-y-4">
            <SectionHeader size="lg" title="Similar Experiences" />
            <div className="space-y-3">
              {similar.map((similarVenue) => (
                <VenueCard
                  areaLabel={areaLabel(similarVenue.destinationId, destinationContext, destinations.data ?? [])}
                  key={similarVenue.id}
                  onToggleSaved={toggle}
                  saved={isSaved(similarVenue.id)}
                  variant="horizontal-row"
                  venue={similarVenue}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
