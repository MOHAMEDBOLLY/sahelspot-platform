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
import { CATEGORY_FILTERS, DEFAULT_CENTER, DEFAULT_ZOOM } from "@/lib/map/config";
import { useVenues } from "@/lib/hooks/useVenues";
import { useDestinations } from "@/lib/hooks/useDestinations";
import { useCategoryTaxonomy } from "@/lib/hooks/useCategoryTaxonomy";
import { ACCESS_TYPES, ACCESS_TYPE_ICON, RESERVATION_POLICIES, type AccessType, type ReservationPolicy } from "@/lib/domain/accessType";
import type { VenueCategory } from "@/lib/domain/venue";

const MAP_TAG_COUNT = 10;
/** Close enough to see a destination's venues spread out, without
 * zooming so far in that a smaller compound only shows one or two pins —
 * the same reasoning `flyToUser`'s own `zoom: 14` documents for a
 * device-precise location, one step wider since a destination covers more
 * ground than a single point. */
const DESTINATION_ZOOM = 13;

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
 * the map itself navigates to. The Destination *filter* is the one
 * exception: it re-centers the camera and narrows which markers are drawn,
 * but still never navigates anywhere on its own.
 *
 * Filter row order — Destination, Category, Category-scoped Tags, Access
 * Type, Reservation Policy — and the taxonomy-scoping logic itself
 * (`useCategoryTaxonomy`) match Search exactly (Category/Tags/Access
 * Type/Badges/Collections architecture, Phase 3): every taxonomy surface
 * in the app reads the same rules, not a screen-specific variant. */
export function MapClient() {
  const router = useRouter();
  const mapRef = useRef<MapViewHandle>(null);
  const venues = useVenues();
  const destinations = useDestinations();

  const [destinationId, setDestinationId] = useState<string | "all">("all");
  const [category, setCategory] = useState<VenueCategory | "all">("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [accessType, setAccessType] = useState<AccessType | "all">("all");
  const [reservationPolicy, setReservationPolicy] = useState<ReservationPolicy | "all">("all");

  const mappableVenues = useMemo(
    () => (venues.data ?? []).filter((venue) => venue.coordinates !== null),
    [venues.data],
  );

  const { popularTags, hasReservationPolicy } = useCategoryTaxonomy(
    mappableVenues,
    category,
    MAP_TAG_COUNT,
  );

  const visibleVenues = useMemo(
    () =>
      mappableVenues.filter((venue) => {
        if (destinationId !== "all" && venue.destinationId !== destinationId) return false;
        if (category !== "all" && venue.category !== category) return false;
        if (accessType !== "all" && venue.accessType !== accessType) return false;
        if (reservationPolicy !== "all" && venue.reservationPolicy !== reservationPolicy) return false;
        if (selectedTags.length > 0 && !selectedTags.some((tag) => venue.tags.includes(tag))) return false;
        return true;
      }),
    [mappableVenues, destinationId, category, accessType, reservationPolicy, selectedTags],
  );

  function toggleTag(slug: string) {
    setSelectedTags((current) =>
      current.includes(slug) ? current.filter((tag) => tag !== slug) : [...current, slug],
    );
  }

  // Tags/Reservation Policy are scoped to the selected category — a value
  // picked under one category has no meaning under another, so switching
  // category clears both rather than silently carrying an invisible,
  // mismatched filter into the new view. Access Type is a category-
  // independent vocabulary (never scoped, see `useCategoryTaxonomy`'s own
  // note), so it's kept — unless the specific combination would guarantee
  // zero results, in which case it resets too rather than silently
  // stranding the user on an empty map.
  function changeCategory(next: VenueCategory | "all") {
    setCategory(next);
    setSelectedTags([]);
    setReservationPolicy("all");
    setAccessType((current) => {
      if (current === "all" || next === "all") return current;
      const stillPossible = mappableVenues.some(
        (venue) => venue.category === next && venue.accessType === current,
      );
      return stillPossible ? current : "all";
    });
  }

  function changeDestination(next: string | "all") {
    setDestinationId(next);
    if (next === "all") {
      mapRef.current?.flyTo(DEFAULT_CENTER, DEFAULT_ZOOM);
      return;
    }
    const destinationVenues = mappableVenues.filter((venue) => venue.destinationId === next);
    if (destinationVenues.length === 0) return;
    const center: [number, number] = [
      destinationVenues.reduce((sum, venue) => sum + venue.coordinates!.lng, 0) / destinationVenues.length,
      destinationVenues.reduce((sum, venue) => sum + venue.coordinates!.lat, 0) / destinationVenues.length,
    ];
    mapRef.current?.flyTo(center, DESTINATION_ZOOM);
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
            onSelectVenue={(venueId) => router.push(`/venues/${venueId}`)}
            ref={mapRef}
            venues={visibleVenues}
          />
        )}
      </div>

      <div className="absolute inset-x-0 top-0 z-20 space-y-3 p-4">
        <SearchField placeholder="Search this area" variant="glass" />

        <div className="hide-scrollbar flex gap-2 overflow-x-auto">
          <FilterChip
            active={destinationId === "all"}
            key="all"
            label="All"
            onClick={() => changeDestination("all")}
          />
          {(destinations.data ?? []).map((destination) => (
            <FilterChip
              active={destinationId === destination.id}
              key={destination.id}
              label={destination.name}
              onClick={() => changeDestination(destination.id)}
            />
          ))}
        </div>

        <div className="hide-scrollbar flex gap-2 overflow-x-auto">
          {CATEGORY_FILTERS.map((filter) => (
            <FilterChip
              active={category === filter.value}
              icon={filter.icon}
              key={filter.value}
              label={filter.label}
              onClick={() => changeCategory(filter.value)}
            />
          ))}
        </div>

        {popularTags.length > 0 ? (
          <div className="hide-scrollbar flex gap-2 overflow-x-auto">
            {popularTags.map((tag) => (
              <FilterChip
                active={selectedTags.includes(tag.slug)}
                icon="sell"
                key={tag.slug}
                label={tag.label}
                onClick={() => toggleTag(tag.slug)}
              />
            ))}
          </div>
        ) : null}

        <div className="hide-scrollbar flex gap-2 overflow-x-auto">
          <FilterChip
            active={accessType === "all"}
            key="all"
            label="Any Access"
            onClick={() => setAccessType("all")}
          />
          {ACCESS_TYPES.map((value) => (
            <FilterChip
              active={accessType === value}
              icon={ACCESS_TYPE_ICON[value]}
              key={value}
              label={value}
              onClick={() => setAccessType(value)}
            />
          ))}
        </div>

        {hasReservationPolicy ? (
          <div className="hide-scrollbar flex gap-2 overflow-x-auto">
            <FilterChip
              active={reservationPolicy === "all"}
              key="all"
              label="Any Reservation"
              onClick={() => setReservationPolicy("all")}
            />
            {RESERVATION_POLICIES.map((value) => (
              <FilterChip
                active={reservationPolicy === value}
                icon="event_available"
                key={value}
                label={`Reservation ${value}`}
                onClick={() => setReservationPolicy(value)}
              />
            ))}
          </div>
        ) : null}
      </div>

      <MapControls
        onLocate={() => mapRef.current?.flyToUser()}
        onToggleLayers={() => mapRef.current?.toggleStyle()}
      />
    </div>
  );
}
