"use client";

import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/patterns/EmptyState";
import { Reveal } from "@/components/patterns/Reveal";
import { SectionHeader } from "@/components/patterns/SectionHeader";
import { CardFrame, LBracketAccent } from "@/components/patterns/CardShell";
import { CTAButton } from "@/components/ui/CTAButton";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { useNoQrAreas } from "@/lib/hooks/useNoQrAreas";
import type { NoQrArea } from "@/lib/domain/noQr";

/** Card System Redesign (SAHELSPOT CONSUMER — CARD SYSTEM REDESIGN ONLY):
 * previously a plain bordered row outside the card family entirely (its own
 * one-off construction). Now built on the same `CardFrame` horizontal
 * anatomy as `VenueCard`'s horizontal-row card — image-slot (here an icon
 * tile, since a No QR Area has no photo), small `LBracketAccent` on that
 * tile's corner, title + metadata, trailing chevron — so it reads as part
 * of the same system instead of a separate mini-app. Visual change only:
 * route, data (`area.id`/`.name`/`.places`/`.type`), and business behavior
 * are unchanged. */
function AreaCard({ area }: { area: NoQrArea }) {
  return (
    <CardFrame bracket={false} className="flex w-full items-center gap-3 p-3" href={`/no-qr/${area.id}`}>
      <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl rounded-tr-none bg-cream">
        <Icon className="text-primary" name={area.type === "Walk" ? "directions_walk" : "storefront"} size={28} />
        <LBracketAccent size="sm" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-bold text-on-surface">{area.name}</h3>
        <p className="text-xs text-on-surface-variant">
          {area.places.length} {area.places.length === 1 ? "place" : "places"}
        </p>
      </div>
      <Icon className="shrink-0 text-primary" name="chevron_right" size={20} />
    </CardFrame>
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
              <Reveal>
                <section>
                  <SectionHeader title="Walks" />
                  <div className="space-y-3">
                    {walks.map((area) => (
                      <AreaCard area={area} key={area.id} />
                    ))}
                  </div>
                </section>
              </Reveal>
            ) : null}

            {malls.length > 0 ? (
              <Reveal>
              <section>
                <SectionHeader title="Malls" />
                <div className="space-y-3">
                  {malls.map((area) => (
                    <AreaCard area={area} key={area.id} />
                  ))}
                </div>
              </section>
              </Reveal>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
