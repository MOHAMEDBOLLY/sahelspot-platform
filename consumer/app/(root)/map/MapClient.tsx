"use client";

import dynamic from "next/dynamic";
import { useMemo, useRef, useState } from "react";
import { BottomSheet } from "@/components/patterns/BottomSheet";
import { CardCarousel } from "@/components/patterns/CardCarousel";
import { FilterChip } from "@/components/patterns/FilterChip";
import { SearchField } from "@/components/patterns/SearchField";
import { SectionHeader } from "@/components/patterns/SectionHeader";
import { StatTile } from "@/components/patterns/StatTile";
import type { MapViewHandle } from "@/components/map/MapView";
import { MapControls } from "@/components/map/MapControls";
import { CTAButton } from "@/components/ui/CTAButton";
import { EmptyState } from "@/components/patterns/EmptyState";
import { VenueCard } from "@/components/venue/VenueCard";
import { CATEGORY_FILTERS } from "@/lib/map/config";
import { useVenues } from "@/lib/hooks/useVenues";
import { useSaved } from "@/lib/saved/useSaved";
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
 * feature module. Reference: `interactive_map_1/code.html`. */
export function MapClient() {
  const mapRef = useRef<MapViewHandle>(null);
  const venues = useVenues();
  const { isSaved, toggle } = useSaved();

  const [category, setCategory] = useState<VenueCategory | "all">("all");
  const [selectedDestinationId, setSelectedDestinationId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const allVenues = useMemo(() => venues.data ?? [], [venues.data]);
  const mappableVenues = useMemo(
    () => allVenues.filter((venue) => venue.coordinates !== null),
    [allVenues],
  );
  const visibleVenues = useMemo(
    () =>
      category === "all"
        ? mappableVenues
        : mappableVenues.filter((venue) => venue.category === category),
    [mappableVenues, category],
  );

  const destinationVenues = useMemo(
    () =>
      selectedDestinationId
        ? allVenues.filter((venue) => venue.destinationId === selectedDestinationId)
        : [],
    [allVenues, selectedDestinationId],
  );
  const selectedDestinationName = destinationVenues[0]?.destinationName ?? "";

  function handleSelectVenue(venueId: string) {
    const venue = allVenues.find((v) => v.id === venueId);
    if (venue) {
      setSelectedDestinationId(venue.destinationId);
      setSheetOpen(true);
    }
  }

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
            isSaved={isSaved}
            onSelectVenue={handleSelectVenue}
            onToggleSaved={toggle}
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

      {/* Always mounted, controlled by `open` — not conditionally rendered on
        * `selectedDestinationId`, which stays set through the close
        * animation so the sheet has real content to slide away with instead
        * of going blank first. */}
      <BottomSheet onClose={() => setSheetOpen(false)} open={sheetOpen} title={selectedDestinationName}>
        {/* Stats are real, computed from the venues actually loaded for this
          * destination — Places/Dining/Beaches counts, not fabricated
          * numbers. There is no "Events" stat: the domain has no event
          * category or content type at all (VenueCategory has no "event"
          * member), so a 4th tile would have nothing real to show — see
          * docs/consumer/API_REQUIREMENTS.md. */}
        <div className="grid grid-cols-3 gap-2">
          <StatTile accent="primary" label="Places" value={destinationVenues.length} />
          <StatTile
            accent="secondary"
            label="Dining"
            value={destinationVenues.filter((v) => v.category === "food" || v.category === "coffee").length}
          />
          <StatTile
            accent="info"
            label="Beaches"
            value={destinationVenues.filter((v) => v.category === "beach").length}
          />
        </div>

        <SectionHeader title="Popular Nearby" />
        {destinationVenues.length === 0 ? (
          <EmptyState
            description="No published places here yet."
            icon="location_off"
            title="Nothing here yet"
          />
        ) : (
          <CardCarousel>
            {destinationVenues.slice(0, 6).map((venue) => (
              <VenueCard
                key={venue.id}
                onToggleSaved={toggle}
                saved={isSaved(venue.id)}
                variant="vertical-compact"
                venue={venue}
              />
            ))}
          </CardCarousel>
        )}
      </BottomSheet>
    </div>
  );
}
