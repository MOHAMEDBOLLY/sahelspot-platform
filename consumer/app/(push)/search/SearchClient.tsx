"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { CategoryChip } from "@/components/patterns/CategoryChip";
import { EmptyState } from "@/components/patterns/EmptyState";
import { FilterChip } from "@/components/patterns/FilterChip";
import { SearchField } from "@/components/patterns/SearchField";
import { SectionHeader } from "@/components/patterns/SectionHeader";
import { CTAButton } from "@/components/ui/CTAButton";
import { IconButton } from "@/components/ui/IconButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { VenueCard } from "@/components/venue/VenueCard";
import { CATEGORY_FILTERS } from "@/lib/map/config";
import { useSearchVenues } from "@/lib/hooks/useSearchVenues";
import { useVenues } from "@/lib/hooks/useVenues";
import { useRecentSearches } from "@/lib/search/useRecentSearches";
import { useSaved } from "@/lib/saved/useSaved";
import {
  ACCESS_TYPES,
  ACCESS_TYPE_ICON,
  RESERVATION_POLICIES,
  type AccessType,
  type ReservationPolicy,
} from "@/lib/domain/accessType";
import { topTags } from "@/lib/domain/tags";
import type { VenueCategory } from "@/lib/domain/venue";

const SEARCH_TAG_COUNT = 10;

/** Home's mood grid, reused for Search's "Popular Categories" — both are
 * `/search?category=` entry points into the same taxonomy. */
const POPULAR_CATEGORIES = [
  { icon: "beach_access", label: "Beaches", category: "beach" },
  { icon: "restaurant", label: "Food", category: "food" },
  { icon: "coffee", label: "Coffee", category: "coffee" },
  { icon: "nightlife", label: "Night", category: "nightlife" },
] as const;

/** Search — spec-only screen (`SahelSpot_Remaining_Screens_Spec.md`); neither
 * Stitch export contains it, unlike the four canonical screens. Built
 * faithfully to the written spec: back + focused SearchField, Recent
 * Searches, Popular Categories, a category FilterChip row, and results —
 * default / results / empty / loading, driven directly by `useSearchVenues`'s
 * own query state rather than screen-local booleans. */
function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSaved, toggle } = useSaved();
  const { recentSearches, addRecentSearch, clearRecentSearches } = useRecentSearches();

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [category, setCategory] = useState<VenueCategory | "all">(
    (searchParams.get("category") as VenueCategory | null) ?? "all",
  );
  // Category/Tags/Access Type/Badges/Collections architecture (Phase 1/2) —
  // same "all" convention `category` already uses. Restored from the URL
  // on load: Home's Popular Tags row and Explore's Browse by Access Type
  // both link in with `?accessType=`/`?tags=` now.
  const [accessType, setAccessType] = useState<AccessType | "all">(
    (searchParams.get("accessType") as AccessType | null) ?? "all",
  );
  const initialTag = searchParams.get("tags");
  const [selectedTags, setSelectedTags] = useState<string[]>(initialTag ? [initialTag] : []);
  // `reservation_policy` has no server-side filter on `/public/search/
  // venues` (api/app/api/routes/search.py) — applied client-side below,
  // over whatever the server-filtered result set already is, rather than
  // sent as a query param the backend wouldn't understand.
  const [reservationPolicy, setReservationPolicy] = useState<ReservationPolicy | "all">(
    (searchParams.get("reservationPolicy") as ReservationPolicy | null) ?? "all",
  );
  // Arrives only from Home's Explore Destinations cards
  // (`/search?destination={id}`) — no in-page control changes it, so it
  // doesn't need its own setter, unlike `query`/`category`.
  const destination = searchParams.get("destination") ?? undefined;

  const hasQuery = Boolean(
    query.trim() ||
      category !== "all" ||
      destination ||
      accessType !== "all" ||
      reservationPolicy !== "all" ||
      selectedTags.length > 0,
  );

  // Popular Tags only renders once `hasQuery` is true (see the results
  // view below) — gated the same way, so landing on Search's default
  // "recent searches" screen never fetches the full venue catalog just to
  // compute chips that aren't on screen yet.
  const venues = useVenues({ enabled: hasQuery });
  const popularTags = useMemo(() => topTags(venues.data ?? [], SEARCH_TAG_COUNT), [venues.data]);

  const results = useSearchVenues({
    q: query,
    category: category === "all" ? undefined : category,
    destination,
    accessType: accessType === "all" ? undefined : accessType,
    tags: selectedTags,
  });
  const filteredResults = useMemo(
    () =>
      reservationPolicy === "all"
        ? results.data
        : results.data?.filter((venue) => venue.reservationPolicy === reservationPolicy),
    [results.data, reservationPolicy],
  );

  function toggleTag(slug: string) {
    setSelectedTags((current) =>
      current.includes(slug) ? current.filter((tag) => tag !== slug) : [...current, slug],
    );
  }

  useEffect(() => {
    if (query.trim()) addRecentSearch(query.trim());
    // Only record a search once it actually runs (Enter/chip tap), not on
    // every keystroke — see the `onKeyDown`/chip `onClick` handlers below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function runSearch(nextQuery: string) {
    setQuery(nextQuery);
    if (nextQuery.trim()) addRecentSearch(nextQuery.trim());
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 flex items-center gap-2 bg-surface p-4">
        <IconButton icon="arrow_back" label="Go back" onClick={() => router.back()} variant="plain" />
        <div className="flex-grow">
          <SearchField
            autoFocus
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") runSearch(query);
            }}
            placeholder="Search for places, beaches, cafes..."
            value={query}
          />
        </div>
      </header>

      <main className="space-y-8 px-4 pb-12">
        {!hasQuery ? (
          <>
            {recentSearches.length > 0 ? (
              <section>
                <SectionHeader
                  actionLabel="Clear All"
                  onActionClick={clearRecentSearches}
                  title="Recent Searches"
                />
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((entry) => (
                    <FilterChip
                      icon="schedule"
                      key={entry}
                      label={entry}
                      onClick={() => runSearch(entry)}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            <section>
              <SectionHeader title="Popular Categories" />
              <div className="grid grid-cols-4 gap-3">
                {POPULAR_CATEGORIES.map((item) => (
                  <CategoryChip
                    icon={item.icon}
                    key={item.category}
                    label={item.label}
                    onClick={() => setCategory(item.category)}
                  />
                ))}
              </div>
            </section>
          </>
        ) : (
          <>
            <section>
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
            </section>

            {/* Category/Tags/Access Type/Badges/Collections architecture
              * (Phase 1/2) — one FilterChip row per taxonomy dimension,
              * never merged into one control, since they're independent
              * (a QR-gated restaurant is still a restaurant, still tagged
              * "sushi"). Tags use real slugs observed across the currently
              * loaded venue list (`lib/domain/tags.ts`), never hardcoded —
              * multi-select with OR semantics, matching
              * `/public/search/venues`'s own `tags` param exactly. */}
            <section>
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
            </section>

            {popularTags.length > 0 ? (
              <section>
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
              </section>
            ) : null}

            {/* Client-side only — see `reservationPolicy` state above for
              * why this can't be a `searchVenues` query param. */}
            <section>
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
            </section>

            <section>
              <SectionHeader
                title={
                  results.isSuccess
                    ? `Results — ${filteredResults?.length ?? 0}`
                    : "Results"
                }
              />
              {results.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-28 w-full" />
                  <Skeleton className="h-28 w-full" />
                  <Skeleton className="h-28 w-full" />
                </div>
              ) : results.isError ? (
                <EmptyState
                  action={
                    <CTAButton onClick={() => results.refetch()} variant="secondary">
                      Retry
                    </CTAButton>
                  }
                  description="We couldn't reach SahelSpot Studio. Check your connection and try again."
                  icon="error_outline"
                  title="Something went wrong"
                />
              ) : (filteredResults?.length ?? 0) === 0 ? (
                <EmptyState
                  action={
                    <CTAButton
                      onClick={() => {
                        setQuery("");
                        setCategory("all");
                        setAccessType("all");
                        setSelectedTags([]);
                        setReservationPolicy("all");
                        // `destination` isn't local state — it's read live
                        // from the URL each render (see its declaration
                        // above) — so clearing it means dropping the query
                        // string, not just resetting component state.
                        if (destination) router.replace("/search");
                      }}
                      variant="secondary"
                    >
                      Clear Filters
                    </CTAButton>
                  }
                  description={
                    reservationPolicy === "all"
                      ? "Try a different search term or category."
                      : "No results match that reservation policy — try clearing a filter."
                  }
                  icon="search_off"
                  title="No results found"
                />
              ) : (
                <div className="space-y-3">
                  {filteredResults?.map((venue) => (
                    <VenueCard
                      key={venue.id}
                      onToggleSaved={toggle}
                      saved={isSaved(venue.id)}
                      variant="horizontal-row"
                      venue={venue}
                    />
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

/** `useSearchParams` requires a Suspense boundary for the static shell to
 * prerender — the boundary itself renders instantly since there's no
 * server data fetch involved, only the initial `?q=`/`?category=` read. */
export function SearchClient() {
  return (
    <Suspense>
      <SearchPageContent />
    </Suspense>
  );
}
