import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/Container";
import { fetchPublishedVenue } from "@/lib/api";

type VenuePageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: VenuePageProps): Promise<Metadata> {
  const { id } = await params;
  const venue = await fetchPublishedVenue(id);

  if (venue === null) {
    return { title: "Venue not found — SahelSpot" };
  }

  return {
    title: `${venue.name} — SahelSpot`,
    description: venue.short_description ?? `${venue.name} in ${venue.destination.name}.`,
  };
}

export default async function VenuePage({ params }: VenuePageProps) {
  const { id } = await params;
  const venue = await fetchPublishedVenue(id);

  if (venue === null) {
    notFound();
  }

  return (
    <Container>
      <div className="py-12">
        <div className="aspect-video overflow-hidden rounded-lg bg-gray-100" />

        <div className="mt-6">
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900">{venue.name}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {venue.category} · {venue.destination.name}
          </p>
        </div>

        {venue.short_description && (
          <p className="mt-6 max-w-2xl text-gray-700">{venue.short_description}</p>
        )}

        {(venue.phone || venue.website || venue.whatsapp) && (
          <div className="mt-8 flex flex-col gap-1 text-sm text-gray-600">
            {venue.phone && <p>Phone: {venue.phone}</p>}
            {venue.whatsapp && <p>WhatsApp: {venue.whatsapp}</p>}
            {venue.website && <p>Website: {venue.website}</p>}
          </div>
        )}
      </div>
    </Container>
  );
}
