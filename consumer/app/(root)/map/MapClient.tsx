"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { FilterChip } from "@/components/patterns/FilterChip";
import { SearchField } from "@/components/patterns/SearchField";
import type { MapViewHandle } from "@/components/map/MapView";
import { MapControls } from "@/components/map/MapControls";
import { CTAButton } from "@/components/ui/CTAButton";
import { EmptyState } from "@/components/patterns/EmptyState";
import { CATEGORY_FILTERS } from "@/lib/map/config";
import { useVenues } from "@/lib/hooks/useVenues";
import type { VenueCategory } from "@/lib/domain/venue";

/** `mapbox-gl` touches `window` at import time, so this must never be part of
 * the server bundle — `ssr: false` is what keeps it out of every other
 * route's payload too, per docs/consumer/ARCHITECTURE.md §5. */
const MapView = dynamic(() => import("@/components/map/MapView").then((m) => m.MapView), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-surface-container-low" />,
});

/** Interactive Map — the highest-risk screen (Stitch's own "map" is a static
 * illustration; this is a real Mapbox surface) and the first fully isolated
 * feature module. Reference: `interactive_map_1/code.html`.
 *
 * Venue-centric, not destination-centric: the map's only navigation target
 * is a venue. Selecting a pin's second tap opens that venue's Details page
 * directly — the destination is contextual information shown *inside*
 * Venue Details (its name, and its "Nearby Places" list), never something
 * the map itself navigates to. */
export function MapClient() {
  const router = useRouter();
  const mapRef = useRef<MapViewHandle>(null);
  const venues = useVenues();

  const [category, setCategory] = useState<VenueCategory | "all">("all");

  const mappableVenues = useMemo(
    () => (venues.data ?? []).filter((venue) => venue.coordinates !== null),
    [venues.data],
  );
  const visibleVenues = useMemo(
    () =>
      category === "all"
        ? mappableVenues
        : mappableVenues.filter((venue) => venue.category === category),
    [mappableVenues, category],
  );

  return (
    <div className="relative h-dvh overflow-hidden pb-[max(6rem,calc(5rem+env(safe-area-inset-bottom)))]">
      <div className="absolute inset-0 z-0">
        {venues.isLoading ? (
          <div className="h-full w-full bg-surface-container-low" />
        ) : venues.isError ? (
          <div className="flex h-full items-center justify-center px-4">
            <EmptyState
              action={
                <CTAButton onClick={() => venues.refetch()} variant="secondary">
                  Retry
                </CTAButton>
              }
              description="We couldn't reach SahelSpot Studio. Check your connection and try again."
              icon="error_outline"
              title="Something went wrong"
            />
          </div>
        ) : (
          <MapView
            activeCategory={category}
            onSelectVenue={(venueId) => router.push(`/venues/${venueId}`)}
            ref={mapRef}
            venues={visibleVenues}
          />
        )}
      </div>

      <div className="absolute inset-x-0 top-0 z-20 space-y-3 p-4">
        <SearchField placeholder="Search this area" variant="glass" />
        <div className="hide-scrollbar flex gap-2 overflow-x-auto">
          {CATEGORY_FILTERS.map((filter) => (
            <FilterChip
              active={category === filter.value}
              icon={filter.icon}
              key={filter.value}
              label={filter.label}
              onClick={() => setCategory(filter.value)}
            />
          ))}
        </div>
      </div>

      <MapControls
        onLocate={() => mapRef.current?.flyToUser()}
        onToggleLayers={() => mapRef.current?.toggleStyle()}
      />
    </div>
  );
}
