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
    return {
      title: venue.name,
      description:
        venue.shortDescription ??
        `${venue.name} in ${venue.destinationName}, North Coast, Egypt.`,
      openGraph: venue.coverImageUrl
        ? { images: [{ url: venue.coverImageUrl }] }
        : undefined,
    };
  } catch {
    return { title: "Venue" };
  }
}

export default async function VenueDetailsPage({ params }: Props) {
  const { id } = await params;
  return <VenueDetailsClient venueId={id} />;
}
