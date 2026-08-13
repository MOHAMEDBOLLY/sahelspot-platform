"use client";

import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { BottomSheet } from "@/components/patterns/BottomSheet";
import { FilterChip } from "@/components/patterns/FilterChip";
import { SearchField } from "@/components/patterns/SearchField";
import { SectionHeader } from "@/components/patterns/SectionHeader";
import type { MapViewHandle } from "@/components/map/MapView";
import { MapControls } from "@/components/map/MapControls";
import { CTAButton } from "@/components/ui/CTAButton";
import { EmptyState } from "@/components/patterns/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { DEFAULT_CENTER, DEFAULT_ZOOM } from "@/lib/map/config";
import { ACCESS_TYPE_CATEGORY_ID, MAP_CATEGORIES } from "@/lib/home/mapCategories";
import { useVenues } from "@/lib/hooks/useVenues";
import { useDestinations } from "@/lib/hooks/useDestinations";
import { topTags } from "@/lib/domain/tags";
import { ACCESS_TYPES, ACCESS_TYPE_ICON, type AccessType } from "@/lib/domain/accessType";
import type { Venue } from "@/lib/domain/venue";

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

type SheetId = "destinations" | "categories" | "filters" | null;

/** Interactive Map — Intent-Driven Filters & Markers (this task). Replaces
 * the old permanent five-row filter wall with a compact Search + three
 * trigger row, each opening the existing `BottomSheet` (already built for
 * this screen, previously unused anywhere). The Mapbox camera/marker/
 * clustering architecture below (`MapView`, `flyTo`/`easeTo`, pitch/
 * bearing, `spreadOverlappingVenues`) is completely untouched — the only
 * thing this task changes is *which* `venues` array `MapClient` computes
 * and hands to `MapView`, and how the UI above the map collects that
 * intent.
 *
 * Core rule: no destination/category/contextual selection ("intent") ->
 * `visibleVenues` is `[]` -> `MapView` renders zero markers/clusters. This
 * is deliberately not the same as the old default ("All" facets read as
 * "show everything") — see `hasIntent` below.
 *
 * Categories reuse `MAP_CATEGORIES` (`lib/home/mapCategories.ts`), which
 * itself derives from `HOME_ACTIVITIES`/`ESSENTIALS_GROUPS`
 * (`lib/home/activities.ts`) — Home's own canonical category id/label/
 * icon/tag-allowlist source. Nothing here redefines a category. */
export function MapClient() {
  const router = useRouter();
  const mapRef = useRef<MapViewHandle>(null);
  const venues = useVenues();
  const destinations = useDestinations();

  const [destinationId, setDestinationId] = useState<string | "all">("all");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedTagsByCategory, setSelectedTagsByCategory] = useState<Record<string, string[]>>({});
  const [selectedAccessTypes, setSelectedAccessTypes] = useState<AccessType[]>([]);
  const [openSheet, setOpenSheet] = useState<SheetId>(null);
  // Unified Search & Filter Toolbar — Search is a control in the same row
  // as the Adaptive FilterChips, not a screen of its own. It doesn't run a
  // second search engine: submitting routes into the existing `/search`
  // screen (`useSearchVenues`), exactly like Home's own `SearchField`
  // already does via `goToSearch`/`router.push`.
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const mappableVenues = useMemo(
    () => (venues.data ?? []).filter((venue) => venue.coordinates !== null),
    [venues.data],
  );

  // Destination-scoped, but not category-scoped — the pool every
  // category's own contextual tag options (and the destination list
  // itself) are computed against, so switching Destination narrows what
  // Categories/Filters offer without needing its own re-derivation.
  const destinationVenues = useMemo(
    () =>
      destinationId === "all"
        ? mappableVenues
        : mappableVenues.filter((venue) => venue.destinationId === destinationId),
    [mappableVenues, destinationId],
  );

  // Rule 9 — marker visibility follows intent, not facet defaults.
  const hasIntent =
    destinationId !== "all" ||
    selectedCategoryIds.length > 0 ||
    Object.values(selectedTagsByCategory).some((tags) => tags.length > 0) ||
    selectedAccessTypes.length > 0;

  const activeVenueCategories = useMemo(
    () =>
      new Set(
        selectedCategoryIds.flatMap(
          (id) => MAP_CATEGORIES.find((category) => category.id === id)?.categories ?? [],
        ),
      ),
    [selectedCategoryIds],
  );

  const visibleVenues = useMemo((): Venue[] => {
    if (!hasIntent) return [];
    return destinationVenues.filter((venue) => {
      if (selectedCategoryIds.length > 0 && !activeVenueCategories.has(venue.category)) return false;

      // Each selected category's own contextual tags only ever constrain
      // venues that actually belong to that category — Coffee's tag
      // filter has no opinion on a Beach venue, even when both are
      // selected at once (Rule 7's "another layer", scoped per category).
      for (const categoryId of selectedCategoryIds) {
        const mapCategory = MAP_CATEGORIES.find((candidate) => candidate.id === categoryId);
        if (!mapCategory || !mapCategory.categories.includes(venue.category)) continue;
        const tags = selectedTagsByCategory[categoryId] ?? [];
        if (tags.length > 0 && !tags.some((tag) => venue.tags.includes(tag))) return false;
      }

      if (
        selectedCategoryIds.includes(ACCESS_TYPE_CATEGORY_ID) &&
        selectedAccessTypes.length > 0 &&
        venue.category === "beach" &&
        (!venue.accessType || !selectedAccessTypes.includes(venue.accessType as AccessType))
      ) {
        return false;
      }

      return true;
    });
  }, [
    destinationVenues,
    hasIntent,
    selectedCategoryIds,
    activeVenueCategories,
    selectedTagsByCategory,
    selectedAccessTypes,
  ]);

  function toggleCategory(id: string) {
    setSelectedCategoryIds((current) => {
      const next = current.includes(id)
        ? current.filter((candidate) => candidate !== id)
        : [...current, id];
      return next;
    });
    // Removing a category clears its own contextual state immediately —
    // Rule 5/10: no invisible filter keeps affecting results once its
    // category chip is gone.
    setSelectedTagsByCategory((current) => {
      if (!(id in current)) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
    if (id === ACCESS_TYPE_CATEGORY_ID) setSelectedAccessTypes([]);
  }

  function toggleTag(categoryId: string, slug: string) {
    setSelectedTagsByCategory((current) => {
      const existing = current[categoryId] ?? [];
      const next = existing.includes(slug)
        ? existing.filter((tag) => tag !== slug)
        : [...existing, slug];
      return { ...current, [categoryId]: next };
    });
  }

  function toggleAccessType(value: AccessType) {
    setSelectedAccessTypes((current) =>
      current.includes(value) ? current.filter((candidate) => candidate !== value) : [...current, value],
    );
  }

  function changeDestination(next: string | "all") {
    setDestinationId(next);
    if (next === "all") {
      mapRef.current?.flyTo(DEFAULT_CENTER, DEFAULT_ZOOM);
      return;
    }
    const destinationVenuesForCenter = mappableVenues.filter((venue) => venue.destinationId === next);
    if (destinationVenuesForCenter.length === 0) return;
    const center: [number, number] = [
      destinationVenuesForCenter.reduce((sum, venue) => sum + venue.coordinates!.lng, 0) /
        destinationVenuesForCenter.length,
      destinationVenuesForCenter.reduce((sum, venue) => sum + venue.coordinates!.lat, 0) /
        destinationVenuesForCenter.length,
    ];
    mapRef.current?.flyTo(center, DESTINATION_ZOOM);
  }

  function clearAll() {
    changeDestination("all");
    setSelectedCategoryIds([]);
    setSelectedTagsByCategory({});
    setSelectedAccessTypes([]);
    setOpenSheet(null);
  }

  function runSearch() {
    const trimmed = searchQuery.trim();
    router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
  }

  function closeSearchIfEmpty() {
    // Same rule the Expanding Search Dock prototype validated: a query in
    // progress must never be silently erased by losing focus.
    if (searchQuery === "") setSearchOpen(false);
  }

  const selectedDestinationName =
    destinationId === "all"
      ? "Destinations"
      : (destinations.data ?? []).find((destination) => destination.id === destinationId)?.name ??
        "Destinations";
  const categoriesLabel =
    selectedCategoryIds.length === 0
      ? "Categories"
      : selectedCategoryIds.length === 1
        ? (MAP_CATEGORIES.find((category) => category.id === selectedCategoryIds[0])?.label ?? "Categories")
        : `${selectedCategoryIds.length} Categories`;
  const contextualFilterCount =
    Object.values(selectedTagsByCategory).reduce((sum, tags) => sum + tags.length, 0) +
    selectedAccessTypes.length;

  // Contextual Result Strip (Full-Bleed Tall Map task) — a compact "this is
  // what the Map is showing" summary, not a venue-card carousel. Only
  // rendered while there's intent, using the same `visibleVenues`/label
  // derivations already computed above; no separate count is invented.
  const resultSummary = hasIntent
    ? `${visibleVenues.length} place${visibleVenues.length === 1 ? "" : "s"}`
    : null;
  const resultDetail = [
    destinationId !== "all" ? selectedDestinationName : null,
    selectedCategoryIds.length > 0 ? categoriesLabel : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="relative h-dvh overflow-hidden">
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
            activeCategory="all"
            onSelectVenue={(venueId) => router.push(`/venues/${venueId}`)}
            ref={mapRef}
            venues={visibleVenues}
          />
        )}
      </div>

      {/* Unified Search & Filter Toolbar (Full-Bleed Tall Map task) — Search
        * and the Adaptive FilterChips now share one horizontal rail instead
        * of Search owning its own row above them. Idle Search is a compact
        * icon control (same footprint as a collapsed FilterChip); tapping
        * it grows the real `SearchField` in place via `flex-1`, and every
        * FilterChip is forced to its icon-only `expanded={false}` state
        * for the duration so the row never wraps — their own active/badge
        * state is untouched underneath, restored the instant Search
        * closes. `AnimatePresence`/`layout` reuse the same tween (0.18s
        * easeOut) `FilterChip` already animates its own width change
        * with, not a new easing curve. */}
      <div className="absolute inset-x-0 top-0 z-20 p-4">
        <motion.div
          className="hide-scrollbar flex items-center gap-2 overflow-x-auto"
          layout
          transition={{ type: "tween", duration: 0.18, ease: "easeOut" }}
        >
          <AnimatePresence initial={false} mode="popLayout">
            {searchOpen ? (
              <motion.div
                animate={{ opacity: 1 }}
                className="min-w-0 flex-1"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
                key="search-field"
                transition={{ duration: 0.12 }}
              >
                <SearchField
                  autoFocus
                  onBlur={closeSearchIfEmpty}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") runSearch();
                  }}
                  placeholder="Search SahelSpot"
                  value={searchQuery}
                  variant="glass"
                />
              </motion.div>
            ) : (
              <motion.button
                animate={{ opacity: 1 }}
                aria-label="Search SahelSpot"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-lowest text-primary shadow-md transition-transform duration-200 ease-out active:scale-[0.96]"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
                key="search-button"
                onClick={() => setSearchOpen(true)}
                transition={{ duration: 0.12 }}
                type="button"
              >
                <Icon name="search" size={20} />
              </motion.button>
            )}
          </AnimatePresence>

          {searchOpen && searchQuery !== "" ? (
            <IconButton
              icon="close"
              label="Clear search"
              onClick={() => setSearchQuery("")}
              variant="glass"
            />
          ) : null}

          {/* Adaptive Map Toolbar — icon-only
            * at rest, icon+label once a control has a selection, via
            * `FilterChip`'s own `expanded`/`badge` props. `aria-label` is
            * set explicitly here (via the prop-spread `FilterChip` already
            * forwards) so the accessible name always names the control
            * even when its visible text becomes just the selected value
            * ("Marina", not "Destinations") — icon-only or expanded, a
            * screen reader never loses which control this is. */}
          <FilterChip
            active={destinationId !== "all"}
            aria-label={
              destinationId !== "all" ? `Destinations: ${selectedDestinationName}` : "Destinations"
            }
            expanded={!searchOpen && destinationId !== "all"}
            icon="location_on"
            label={destinationId !== "all" ? selectedDestinationName : "Destinations"}
            onClick={() => setOpenSheet("destinations")}
          />
          <FilterChip
            active={selectedCategoryIds.length > 0}
            aria-label={
              selectedCategoryIds.length > 0 ? `Categories: ${categoriesLabel}` : "Categories"
            }
            expanded={!searchOpen && selectedCategoryIds.length > 0}
            icon="sell"
            label={selectedCategoryIds.length > 0 ? categoriesLabel : "Categories"}
            onClick={() => setOpenSheet("categories")}
          />
          <FilterChip
            active={contextualFilterCount > 0}
            badge={contextualFilterCount > 0 ? contextualFilterCount : undefined}
            expanded={false}
            icon="tune"
            label="Filters"
            onClick={() => setOpenSheet("filters")}
          />
          {hasIntent && !searchOpen ? (
            <FilterChip icon="close" label="Clear" onClick={clearAll} />
          ) : null}
        </motion.div>
      </div>

      <MapControls
        onLocate={() => mapRef.current?.flyToUser()}
        onToggleLayers={() => mapRef.current?.toggleStyle()}
      />

      {resultSummary ? (
        <div className="absolute inset-x-4 bottom-24 z-20 rounded-2xl bg-surface-container-lowest/95 px-4 py-3 shadow-[var(--shadow-sheet)] backdrop-blur">
          <p className="text-sm font-semibold text-on-surface">{resultSummary}</p>
          {resultDetail ? <p className="text-xs text-on-surface-variant">{resultDetail}</p> : null}
        </div>
      ) : null}

      <BottomSheet onClose={() => setOpenSheet(null)} open={openSheet === "destinations"} title="Destinations">
        <div className="flex flex-wrap gap-2">
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
      </BottomSheet>

      <BottomSheet onClose={() => setOpenSheet(null)} open={openSheet === "categories"} title="Categories">
        <div className="flex flex-wrap gap-2">
          {MAP_CATEGORIES.map((category) => (
            <FilterChip
              active={selectedCategoryIds.includes(category.id)}
              icon={category.icon}
              key={category.id}
              label={category.label}
              onClick={() => toggleCategory(category.id)}
            />
          ))}
        </div>
      </BottomSheet>

      <BottomSheet onClose={() => setOpenSheet(null)} open={openSheet === "filters"} title="Filters">
        {selectedCategoryIds.length === 0 ? (
          <p className="text-sm text-on-surface-variant">
            Select a category first to see its filters.
          </p>
        ) : (
          <div className="space-y-6">
            {selectedCategoryIds.map((categoryId) => {
              const mapCategory = MAP_CATEGORIES.find((candidate) => candidate.id === categoryId);
              if (!mapCategory) return null;

              // Scoped to this category's own venues within the current
              // destination — the same "tags are category-scoped, not
              // global" rule Search/the old Map already followed
              // (`useCategoryTaxonomy`), just computed once per selected
              // category here instead of for a single active one.
              const categoryVenues = destinationVenues.filter((venue) =>
                mapCategory.categories.includes(venue.category),
              );
              const tagOptions = mapCategory.allowedTags
                ? topTags(categoryVenues, MAP_TAG_COUNT).filter((tag) =>
                    mapCategory.allowedTags!.includes(tag.slug),
                  )
                : [];
              const showAccessType = categoryId === ACCESS_TYPE_CATEGORY_ID;

              if (tagOptions.length === 0 && !showAccessType) return null;

              return (
                <div key={categoryId}>
                  <SectionHeader size="lg" title={mapCategory.label} />
                  {tagOptions.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {tagOptions.map((tag) => (
                        <FilterChip
                          active={(selectedTagsByCategory[categoryId] ?? []).includes(tag.slug)}
                          icon="sell"
                          key={tag.slug}
                          label={tag.label}
                          onClick={() => toggleTag(categoryId, tag.slug)}
                        />
                      ))}
                    </div>
                  ) : null}
                  {showAccessType ? (
                    <div className="mt-3">
                      <p className="mb-2 text-xs font-semibold tracking-wide text-on-surface-variant uppercase">
                        Access
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {ACCESS_TYPES.map((value) => (
                          <FilterChip
                            active={selectedAccessTypes.includes(value)}
                            icon={ACCESS_TYPE_ICON[value]}
                            key={value}
                            label={value}
                            onClick={() => toggleAccessType(value)}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
