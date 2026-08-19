"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { CategoryChip } from "@/components/patterns/CategoryChip";
import { EmptyState } from "@/components/patterns/EmptyState";
import { FilterChip } from "@/components/patterns/FilterChip";
import { LoadingFade } from "@/components/patterns/LoadingFade";
import { SearchAutocomplete } from "@/components/patterns/SearchAutocomplete";
import { SectionHeader } from "@/components/patterns/SectionHeader";
import { CTAButton } from "@/components/ui/CTAButton";
import { IconButton } from "@/components/ui/IconButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { VenueCard } from "@/components/venue/VenueCard";
import { CATEGORY_FILTERS } from "@/lib/map/config";
import { findAllowedTags } from "@/lib/home/activities";
import { useSearchVenues } from "@/lib/hooks/useSearchVenues";
import { useVenues } from "@/lib/hooks/useVenues";
import { useCategoryTaxonomy } from "@/lib/hooks/useCategoryTaxonomy";
import { useRecentSearches } from "@/lib/search/useRecentSearches";
import { useSaved } from "@/lib/saved/useSaved";
import { capture } from "@/lib/analytics/analytics";
import {
  ACCESS_TYPES,
  ACCESS_TYPE_ICON,
  RESERVATION_POLICIES,
  type AccessType,
  type ReservationPolicy,
} from "@/lib/domain/accessType";
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
  const reduceMotion = useReducedMotion();
  // Final Search UX audit — the autocomplete dropdown shows its own Recent
  // Searches list (`SearchSuggestions`) whenever it's open and the query
  // hasn't reached `SEARCH_MIN_QUERY_LENGTH` yet, which is exactly this
  // page's own "!hasQuery" default state. Without this, both rendered at
  // once: the dropdown floating over the page's own Recent Searches section
  // showing the identical chips a few rows below. Tracked via
  // `SearchAutocomplete`'s `onSurfaceOpenChange` rather than re-deriving the
  // dropdown's open state here, so there's exactly one source of truth for
  // it.
  const [isSuggestSurfaceOpen, setIsSuggestSurfaceOpen] = useState(false);
  const handleSuggestSurfaceOpenChange = useCallback((open: boolean) => setIsSuggestSurfaceOpen(open), []);

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
  // V1 Home taxonomy — set only when arriving from a Home activity chip
  // (`?activity=quick-bites`, see `activityHref` in `lib/home/activities.ts`).
  // Cleared on `changeCategory` (below) since an allow-list scoped to one
  // activity has no meaning once the user picks a different category —
  // same reasoning already applied to `selectedTags`/`reservationPolicy`.
  const [activityId, setActivityId] = useState<string | null>(
    searchParams.get("activity"),
  );
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

  // Tags only render once `hasQuery` is true (see the results view below)
  // — gated the same way, so landing on Search's default "recent searches"
  // screen never fetches the full venue catalog just to compute chips
  // that aren't on screen yet.
  const venues = useVenues({ enabled: hasQuery });

  // Tags are category-scoped, not global — a Beach venue and a Restaurant
  // venue don't share a tag vocabulary in practice, so mixing "Pizza" into
  // a Beaches search is noise, not discovery. With no category selected
  // there's no scope to derive tags from, so the row stays empty rather
  // than falling back to a global aggregate. Shared with Map — see
  // `useCategoryTaxonomy`'s own docstring for why this one hook is the
  // single source both screens read from.
  const { popularTags: categoryTags, hasReservationPolicy: categoryHasReservationPolicy } =
    useCategoryTaxonomy(venues.data ?? [], category, SEARCH_TAG_COUNT);

  // V1 Home taxonomy — when the current activity (a `HOME_ACTIVITIES`
  // entry or an `ESSENTIALS_GROUPS` entry, see `findAllowedTags`) has an
  // `allowedTags` list, narrow `topTags()`'s category-wide result down to
  // just those slugs (still in `topTags()`'s own count-desc order). This
  // is what separates Quick Bites from Restaurants despite both being
  // `food`, and Essentials' Shopping from Services: a tag outside the
  // active allow-list is filtered out here, never renamed or reassigned.
  // No allow-list (Beaches, or Search reached without an `activity` param)
  // falls back to every tag the category has, unrestricted — existing
  // behavior.
  const activityAllowedTags = findAllowedTags(activityId);
  const popularTags = activityAllowedTags
    ? categoryTags.filter((tag) => activityAllowedTags.includes(tag.slug))
    : categoryTags;

  // `category` isn't sent to `searchVenues` — see that function's own note
  // on why the backend's raw-string category filter can't be driven by the
  // Consumer's domain buckets. Driven with this page's own `hasQuery`
  // instead of the hook's params-derived default, since category alone
  // (with q/destination/accessType/tags all empty) is a valid reason to
  // fetch here even though the hook itself no longer sees any param for it.
  const results = useSearchVenues(
    {
      q: query,
      destination,
      accessType: accessType === "all" ? undefined : accessType,
      tags: selectedTags,
    },
    { enabled: hasQuery },
  );
  // Category and Reservation Policy are both applied client-side, over
  // whatever `results` already returned — category because the backend
  // filter can't take a domain bucket (see `searchVenues`), reservation
  // policy because no server-side filter for it exists at all. One filter
  // pass, not two separate ones, so there's a single place this logic
  // lives.
  const filteredResults = useMemo(() => {
    let matches = results.data;
    if (category !== "all") {
      matches = matches?.filter((venue) => venue.category === category);
    }
    if (reservationPolicy !== "all") {
      matches = matches?.filter((venue) => venue.reservationPolicy === reservationPolicy);
    }
    return matches;
  }, [results.data, category, reservationPolicy]);

  function toggleTag(slug: string) {
    setSelectedTags((current) =>
      current.includes(slug) ? current.filter((tag) => tag !== slug) : [...current, slug],
    );
  }

  // Tags/Reservation Policy are scoped to the selected category — a value
  // picked under one category has no meaning under another, so switching
  // category clears both rather than silently carrying an invisible,
  // mismatched filter into the new results. Access Type stays (it's
  // category-independent, see `useCategoryTaxonomy`), unless the specific
  // combination would guarantee zero results, matching Map's identical
  // reset logic (Category/Tags/Access Type/Badges/Collections
  // architecture, Phase 3 — every taxonomy surface follows the same rule).
  function changeCategory(next: VenueCategory | "all") {
    setCategory(next);
    setActivityId(null);
    setSelectedTags([]);
    setReservationPolicy("all");
    setAccessType((current) => {
      if (current === "all" || next === "all") return current;
      const stillPossible = (venues.data ?? []).some(
        (venue) => venue.category === next && venue.accessType === current,
      );
      return stillPossible ? current : "all";
    });
  }

  useEffect(() => {
    if (query.trim()) addRecentSearch(query.trim());
    // Only record a search once it actually runs (Enter/chip tap), not on
    // every keystroke — see the `onKeyDown`/chip `onClick` handlers below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fires the `search` event once the query this action actually kicked off
  // has settled, not at submit time — `result_count` isn't known until then.
  // Cleared after firing so a later category/filter-only refetch (no new
  // `runSearch` call) never re-sends it.
  const [pendingSearch, setPendingSearch] = useState<{
    query: string;
    source: "search_page" | "recent";
  } | null>(null);

  useEffect(() => {
    if (!pendingSearch || !hasQuery || results.isLoading) return;
    capture("search", {
      query: pendingSearch.query,
      result_count: filteredResults?.length ?? 0,
      source: pendingSearch.source,
    });
    setPendingSearch(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSearch, hasQuery, results.isLoading, filteredResults]);

  function runSearch(nextQuery: string, source: "search_page" | "recent" = "search_page") {
    setQuery(nextQuery);
    if (nextQuery.trim()) {
      addRecentSearch(nextQuery.trim());
      setPendingSearch({ query: nextQuery.trim(), source });
    }
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 flex items-center gap-2 bg-surface p-4">
        <IconButton icon="arrow_back" label="Go back" onClick={() => router.back()} variant="plain" />
        <div className="flex-grow">
          <SearchAutocomplete
            autoFocus
            onChange={setQuery}
            onSelectCategory={(value) => changeCategory(value as VenueCategory)}
            onSelectDestination={(destinationId) => router.push(`/search?destination=${destinationId}`)}
            onSelectVenue={(venue) => router.push(`/venues/${venue.id}`)}
            onSubmit={runSearch}
            onSurfaceOpenChange={handleSuggestSurfaceOpenChange}
            placeholder="Search for places, beaches, cafes..."
            value={query}
          />
        </div>
      </header>

      <main className="space-y-8 px-4 pb-12">
        {!hasQuery ? (
          <>
            {recentSearches.length > 0 && !isSuggestSurfaceOpen ? (
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
                      onClick={() => runSearch(entry, "recent")}
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
                    onClick={() => changeCategory(item.category)}
                  />
                ))}
              </div>
            </section>
          </>
        ) : (
          <>
            {/* A category arriving pre-selected (Home's activity chips, a
              * "See All" link, any `?category=` deep link) means the user
              * already made this choice — re-showing the same row here
              * would ask them to pick it again. Only Search's own default
              * entry point (Bottom Nav, `category` still "all") shows it. */}
            {category === "all" ? (
              <section>
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
              </section>
            ) : (
              <SectionHeader
                actionLabel="Change"
                onActionClick={() => changeCategory("all")}
                title={CATEGORY_FILTERS.find((filter) => filter.value === category)?.label ?? ""}
              />
            )}

            {/* Category/Tags/Access Type/Badges/Collections architecture
              * (Phase 1/2) — one FilterChip row per taxonomy dimension,
              * never merged into one control, since they're independent
              * (a QR-gated restaurant is still a restaurant, still tagged
              * "sushi"). Tags use real slugs observed across the currently
              * loaded venue list (`lib/domain/tags.ts`), never hardcoded —
              * multi-select with OR semantics, matching
              * `/public/search/venues`'s own `tags` param exactly.
              *
              * Access Type is presentation-restricted to Beaches only (Final
              * Polish, Part 4) — every other category's taxonomy is tags,
              * not access method, so the row is simply not rendered outside
              * `category === "beach"`. This is a display rule, not a
              * taxonomy change: `accessType` state and the `searchVenues`
              * query param are untouched, so a value set while on Beaches
              * still filters correctly if it survives a category change.
              *
              * Exception (Explore Access Type Flow Fix): also shown when
              * `accessType !== "all"`, regardless of category. Explore's
              * "Browse by Access Type" links straight into `?accessType=`
              * with no category — hiding the row there left an active,
              * already-applied filter with no visible chip, no "why are
              * these my results" explanation, and no way to change or
              * clear it. `changeCategory` already preserves `accessType`
              * across a category change back to "all" (see its own
              * comment above) — that state was never the bug, only this
              * row's visibility was. */}
            {category === "beach" || accessType !== "all" ? (
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
            ) : null}

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
              * why this can't be a `searchVenues` query param. Category-
              * scoped like Tags: only rendered when a venue in the
              * selected category actually carries a reservation policy. */}
            {categoryHasReservationPolicy ? (
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
            ) : null}

            <section>
              <SectionHeader
                title={
                  results.isSuccess
                    ? // Arriving via a Destination card (`?destination=`) gave no
                      // on-screen confirmation of which destination was active —
                      // just a generic "Results — N" — so a first-time user had
                      // no way to tell this list was filtered at all. Reuses the
                      // destination name already present on each result
                      // (`Venue.destinationName`), not a second fetch.
                      `Results${destination && filteredResults?.[0] ? ` in ${filteredResults[0].destinationName}` : ""} — ${filteredResults?.length ?? 0}`
                    : "Results"
                }
              />
              <LoadingFade
                loading={results.isLoading}
                skeleton={
                  <div className="space-y-3">
                    <Skeleton className="h-28 w-full" />
                    <Skeleton className="h-28 w-full" />
                    <Skeleton className="h-28 w-full" />
                  </div>
                }
              >
                {results.isError ? (
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
                  // Motion & Micro-Interactions Upgrade, item 4 — "content
                  // should transition using a short fade + vertical movement"
                  // on a filter change, not a hard reload of the section.
                  // Keyed on the filter combination (not `query`, which
                  // changes per keystroke and would retrigger this on every
                  // character typed) — React remounts this `motion.div` when
                  // the key changes, replaying the enter animation for the
                  // new result set. Unaffected by `LoadingFade` above, which
                  // only owns the loading -> settled crossfade, not this
                  // per-filter-change replay.
                  <motion.div
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3"
                    initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                    key={`${category}:${accessType}:${reservationPolicy}:${selectedTags.join(",")}`}
                    transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {filteredResults?.map((venue) => (
                      <VenueCard
                        key={venue.id}
                        onToggleSaved={toggle}
                        saved={isSaved(venue.id)}
                        variant="horizontal-row"
                        venue={venue}
                      />
                    ))}
                  </motion.div>
                )}
              </LoadingFade>
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
