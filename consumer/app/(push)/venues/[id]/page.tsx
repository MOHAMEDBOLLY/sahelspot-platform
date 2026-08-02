import type { Metadata } from "next";
import { fetchVenue } from "@/lib/api/venues";
import { toVenue } from "@/lib/domain/mappers/venue";
import { VenueDetailsClient } from "./VenueDetailsClient";

type Props = { params: Promise<{ id: string }> };

/** Runs server-side, so this reaches `/public/venues/{id}` directly — no
 * browser CORS involved, unlike the client's own `useVenue`. A 404 or a
 * request failure both degrade to a generic title rather than throwing:
 * metadata failing to generate shouldn't take the page down, and
 * `VenueDetailsClient`'s own `useVenue` call is what actually renders the
 * 404/error UI a visitor sees. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const dto = await fetchVenue(id);
    if (!dto) return { title: "Venue not found" };
    const venue = toVenue(dto);
    const description =
      venue.shortDescription ??
      `${venue.name} in ${venue.destinationName}, North Coast, Egypt.`;
    // Next.js metadata objects aren't deep-merged with the parent layout's
    // — a child `openGraph`/`twitter` fully replaces the parent's, so this
    // has to be complete on its own rather than relying on inheriting
    // `siteName`/`type`/`locale` from `app/layout.tsx`.
    //
    // No fallback share image exists in the codebase (there is no
    // `public/` directory at all) — a venue with no `coverImageUrl` ships
    // with `images: undefined` rather than inventing a placeholder asset,
    // consistent with this app's rule of never fabricating content it
    // doesn't have a real source for.
    const images = venue.coverImageUrl ? [{ url: venue.coverImageUrl }] : undefined;
    return {
      title: venue.name,
      description,
      openGraph: {
        title: venue.name,
        description,
        siteName: "SahelSpot",
        type: "website",
        locale: "en_US",
        images,
      },
      twitter: {
        card: images ? "summary_large_image" : "summary",
        title: venue.name,
        description,
        images,
      },
    };
  } catch {
    return { title: "Venue" };
  }
}

export default async function VenueDetailsPage({ params }: Props) {
  const { id } = await params;
  return <VenueDetailsClient venueId={id} />;
}
