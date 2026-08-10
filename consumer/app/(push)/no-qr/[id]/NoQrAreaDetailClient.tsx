"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/patterns/EmptyState";
import { SectionHeader } from "@/components/patterns/SectionHeader";
import { CTAButton } from "@/components/ui/CTAButton";
import { IconButton } from "@/components/ui/IconButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { useNoQrAreas } from "@/lib/hooks/useNoQrAreas";
import type { NoQrPlace } from "@/lib/domain/noQr";

function PlaceRow({ place }: { place: NoQrPlace }) {
  // Existing Venue: navigable to the real venue detail page. Standalone
  // place: discovery-only, never linked — there is no venue detail to
  // send it to, and inventing one would fabricate a Venue that doesn't
  // exist (the one thing this whole feature must not do).
  if (place.venue) {
    return (
      <Link
        className="flex items-center justify-between rounded-lg border border-outline-variant bg-surface p-4"
        href={`/venues/${place.venue.id}`}
      >
        <div>
          <p className="font-semibold text-primary">{place.venue.name}</p>
          <p className="text-sm text-on-surface-variant">Existing venue</p>
        </div>
      </Link>
    );
  }
  return (
    <div className="rounded-lg border border-outline-variant bg-surface p-4">
      <p className="font-semibold text-primary">{place.name}</p>
      <p className="text-sm text-on-surface-variant">Standalone place</p>
    </div>
  );
}

export function NoQrAreaDetailClient({ areaId }: { areaId: number }) {
  const router = useRouter();
  const areas = useNoQrAreas();
  const area = areas.data?.find((candidate) => candidate.id === areaId);

  return (
    <div className="min-h-dvh pb-12">
      <header className="sticky top-0 z-10 flex items-center gap-2 bg-surface p-4">
        <IconButton icon="arrow_back" label="Go back" onClick={() => router.back()} variant="plain" />
        <h1 className="text-xl font-bold text-primary">{area?.name ?? "No QR"}</h1>
      </header>

      <main className="space-y-6 px-4">
        {areas.isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : areas.isError ? (
          <EmptyState
            action={
              <CTAButton onClick={() => areas.refetch()} variant="secondary">
                Retry
              </CTAButton>
            }
            description="We couldn't reach SahelSpot Studio. Check your connection and try again."
            icon="error_outline"
            title="Something went wrong"
          />
        ) : !area ? (
          <EmptyState
            action={<CTAButton href="/no-qr">Back to No QR</CTAButton>}
            description="This area may have been removed."
            icon="directions_walk"
            title="Area not found"
          />
        ) : (
          <>
            <p className="text-sm font-medium text-on-surface-variant">{area.type}</p>

            <section>
              <SectionHeader title="Places" />
              {area.places.length === 0 ? (
                <EmptyState description="No places here yet." icon="place" title="No places yet" />
              ) : (
                <div className="space-y-3">
                  {area.places.map((place) => (
                    <PlaceRow key={place.id} place={place} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
