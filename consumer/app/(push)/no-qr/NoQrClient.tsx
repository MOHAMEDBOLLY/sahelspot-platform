"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/patterns/EmptyState";
import { SectionHeader } from "@/components/patterns/SectionHeader";
import { CTAButton } from "@/components/ui/CTAButton";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { useNoQrAreas } from "@/lib/hooks/useNoQrAreas";
import type { NoQrArea } from "@/lib/domain/noQr";

function AreaCard({ area }: { area: NoQrArea }) {
  return (
    <Link
      className="flex items-center justify-between rounded-lg border border-outline-variant bg-surface p-4"
      href={`/no-qr/${area.id}`}
    >
      <div>
        <p className="font-semibold text-primary">{area.name}</p>
        <p className="text-sm text-on-surface-variant">
          {area.places.length} {area.places.length === 1 ? "place" : "places"}
        </p>
      </div>
      <Icon className="text-on-surface-variant" name="chevron_right" />
    </Link>
  );
}

/** No QR Independent Entity — Consumer discovery. Same loading/error/empty
 * pattern every other data-backed screen already follows (Events, Search).
 * Walks and Malls are kept in two separate sections, split purely on
 * `area.type` — never derived from a place's Venue category, tags, or
 * name (see `useCategoryTaxonomy`'s equivalent comment on why tags are
 * never mixed across an unrelated grouping). An Area with zero places
 * still renders — that's real state, not filtered out. */
export function NoQrClient() {
  const router = useRouter();
  const areas = useNoQrAreas();

  const walks = areas.data?.filter((area) => area.type === "Walk") ?? [];
  const malls = areas.data?.filter((area) => area.type === "Mall") ?? [];

  return (
    <div className="min-h-dvh pb-12">
      <header className="sticky top-0 z-10 flex items-center gap-2 bg-surface p-4">
        <IconButton icon="arrow_back" label="Go back" onClick={() => router.back()} variant="plain" />
        <h1 className="text-xl font-bold text-primary">No QR</h1>
      </header>

      <main className="space-y-8 px-4">
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
        ) : (areas.data?.length ?? 0) === 0 ? (
          <EmptyState description="No QR places yet." icon="directions_walk" title="Nothing here yet" />
        ) : (
          <>
            {walks.length > 0 ? (
              <section>
                <SectionHeader title="Walks" />
                <div className="space-y-3">
                  {walks.map((area) => (
                    <AreaCard area={area} key={area.id} />
                  ))}
                </div>
              </section>
            ) : null}

            {malls.length > 0 ? (
              <section>
                <SectionHeader title="Malls" />
                <div className="space-y-3">
                  {malls.map((area) => (
                    <AreaCard area={area} key={area.id} />
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
