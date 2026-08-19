"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchVenues } from "@/lib/api/venues";
import { toVenue } from "@/lib/domain/mappers/venue";
import { CATEGORY_FILTERS } from "@/lib/domain/categories";
import { useVenues } from "@/lib/hooks/useVenues";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { useRecentSearches } from "@/lib/search/useRecentSearches";
import { rankVenuesByName } from "@/lib/search/ranking";
import {
  SEARCH_DEBOUNCE_MS,
  SEARCH_MAX_SUGGESTIONS_PER_GROUP,
  SEARCH_MIN_QUERY_LENGTH,
} from "@/lib/search/constants";

export type DestinationSuggestion = { id: string; name: string };
export type CategorySuggestion = { value: string; label: string; icon?: string };

/** Search Autocomplete P0/P1 — composes the *existing* search infrastructure
 * (`searchVenues`/`/public/search/venues`, `useVenues`, `useRecentSearches`)
 * into one hook, rather than replacing any of it. Matches the audit's §21
 * recommended architecture exactly: no new endpoint, no new persistence, no
 * backend change.
 *
 * Debounce + minimum length (audit §11/§12) fix the pre-existing bug this
 * hook must not inherit: once `SearchClient`'s own `hasQuery` was true, every
 * keystroke changed `useSearchVenues`'s query key and refetched with no
 * debounce at all (`lib/hooks/useSearchVenues.ts`). This hook's query key is
 * built from the *debounced* value, and is disabled below
 * `SEARCH_MIN_QUERY_LENGTH`, so neither problem carries over here.
 *
 * Cancellation (audit §5 P0.3): TanStack Query passes its own per-query
 * `AbortSignal` into `queryFn`'s second argument and aborts the in-flight
 * request itself whenever the query key changes before it resolves — the
 * built-in mechanism the audit's P0.3 asks to prefer over inventing a
 * parallel one. Threaded straight through to `searchVenues` -> `apiGetList`. */
export function useSearchSuggestions(rawQuery: string) {
  const debouncedQuery = useDebouncedValue(rawQuery.trim(), SEARCH_DEBOUNCE_MS);
  const isActive = debouncedQuery.length >= SEARCH_MIN_QUERY_LENGTH;

  const { recentSearches, addRecentSearch, clearRecentSearches } = useRecentSearches();

  // Full catalog, shared cache entry with every other `useVenues()` caller
  // (Home, Map) — only used here to derive Destination suggestions
  // client-side (audit §7.A / §21), never as a second search mechanism.
  // Gated behind `isActive` for the same reason `SearchClient` already
  // gates it: no point fetching the whole catalog before there's a query
  // long enough to filter it by.
  const catalog = useVenues({ enabled: isActive });

  const venueSuggestions = useQuery({
    queryKey: ["venues", "suggest", debouncedQuery],
    queryFn: async ({ signal }) => {
      const dtos = await searchVenues({ q: debouncedQuery }, signal);
      return dtos.map(toVenue);
    },
    enabled: isActive,
  });

  const rankedVenues = useMemo(() => {
    if (!venueSuggestions.data) return [];
    return rankVenuesByName(venueSuggestions.data, debouncedQuery).slice(
      0,
      SEARCH_MAX_SUGGESTIONS_PER_GROUP,
    );
  }, [venueSuggestions.data, debouncedQuery]);

  const destinationSuggestions = useMemo<DestinationSuggestion[]>(() => {
    if (!isActive || !catalog.data) return [];
    const normalizedQuery = debouncedQuery.toLowerCase();
    const seen = new Map<string, string>();
    for (const venue of catalog.data) {
      if (seen.has(venue.destinationId)) continue;
      if (venue.destinationName.toLowerCase().includes(normalizedQuery)) {
        seen.set(venue.destinationId, venue.destinationName);
      }
    }
    return Array.from(seen, ([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, SEARCH_MAX_SUGGESTIONS_PER_GROUP);
  }, [isActive, catalog.data, debouncedQuery]);

  const categorySuggestions = useMemo<CategorySuggestion[]>(() => {
    if (!isActive) return [];
    const normalizedQuery = debouncedQuery.toLowerCase();
    return CATEGORY_FILTERS.filter(
      (filter) => filter.value !== "all" && filter.label.toLowerCase().includes(normalizedQuery),
    )
      .map((filter) => ({ value: filter.value, label: filter.label, icon: filter.icon }))
      .slice(0, SEARCH_MAX_SUGGESTIONS_PER_GROUP);
  }, [isActive, debouncedQuery]);

  const isLoading = isActive && (venueSuggestions.isLoading || (catalog.isLoading && catalog.fetchStatus !== "idle"));
  const isError = isActive && venueSuggestions.isError;
  const hasResults =
    rankedVenues.length > 0 || destinationSuggestions.length > 0 || categorySuggestions.length > 0;

  return {
    query: debouncedQuery,
    isActive,
    isLoading,
    isError,
    isEmpty: isActive && !isLoading && !isError && !hasResults,
    refetch: () => venueSuggestions.refetch(),
    venues: rankedVenues,
    destinations: destinationSuggestions,
    categories: categorySuggestions,
    recentSearches,
    addRecentSearch,
    clearRecentSearches,
  };
}
