"use client";

import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Venue } from "@/lib/domain/venue";
import type {
  CategorySuggestion,
  DestinationSuggestion,
} from "@/lib/hooks/useSearchSuggestions";

export type SearchOption =
  | { kind: "recent"; id: string; term: string }
  | { kind: "destination"; id: string; destinationId: string; name: string }
  | { kind: "category"; id: string; value: string; label: string; icon?: string }
  | { kind: "venue"; id: string; venue: Venue };

/** Builds the exact flat, ordered option list the dropdown renders — the
 * single source both `SearchAutocomplete`'s ArrowUp/ArrowDown index math and
 * this component's own grouped render read from, so keyboard navigation can
 * never land on an option that isn't actually visible (or skip one that is).
 *
 * Default/short-query state (audit §7.F, §13 state 2): Recent Searches only,
 * reusing `useRecentSearches` — no new persistence. Active state (§8):
 * Destinations -> Categories -> Venues, per the audit's recommended grouping
 * order. Events/Collections are never included — P2/out of scope. */
export function buildSearchOptions(params: {
  isActive: boolean;
  recentSearches: string[];
  destinations: DestinationSuggestion[];
  categories: CategorySuggestion[];
  venues: Venue[];
}): SearchOption[] {
  if (!params.isActive) {
    return params.recentSearches.map((term) => ({ kind: "recent", id: `recent-${term}`, term }));
  }
  return [
    ...params.destinations.map((destination) => ({
      kind: "destination" as const,
      id: `destination-${destination.id}`,
      destinationId: destination.id,
      name: destination.name,
    })),
    ...params.categories.map((category) => ({
      kind: "category" as const,
      id: `category-${category.value}`,
      value: category.value,
      label: category.label,
      icon: category.icon,
    })),
    ...params.venues.map((venue) => ({ kind: "venue" as const, id: `venue-${venue.id}`, venue })),
  ];
}

const GROUP_LABEL: Record<Exclude<SearchOption["kind"], "recent">, string> = {
  destination: "Destinations",
  category: "Categories",
  venue: "Venues",
};

function GroupLabel({ children }: { children: string }) {
  return (
    <p className="px-3 pt-2.5 pb-1 text-[11px] font-bold tracking-wider text-on-surface-variant uppercase">
      {children}
    </p>
  );
}

function OptionRow({
  active,
  id,
  onClick,
  children,
}: {
  active: boolean;
  id: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-selected={active}
      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
        active ? "bg-surface-container" : "hover:bg-surface-container-lowest"
      }`}
      id={id}
      onClick={onClick}
      // `preventDefault` here stops the browser's default mousedown focus
      // handling, which is what would otherwise blur the input (closing the
      // surface, per its own `onBlur`) before the `click` event — and this
      // handler's `onClick` — ever run. The actual selection still happens
      // in `onClick`, not here, so it fires the same way for every input
      // method (mouse, touch, or an automated/synthetic click that only
      // dispatches `click`).
      onMouseDown={(event) => event.preventDefault()}
      role="option"
      type="button"
    >
      {children}
    </button>
  );
}

/** The dropdown's content — grouped suggestions, loading/empty/error states.
 * Deliberately text-first (audit §16/§18): venue rows show name + destination
 * only, no thumbnail, so a fast typist isn't triggering an image request per
 * keystroke's result set. Reuses `EmptyState`'s icon+title language but as a
 * compact inline row, not the full-page treatment `SearchClient` already uses
 * for its own zero-results state (audit §14). */
export function SearchSuggestions({
  listboxId,
  isLoading,
  isError,
  isEmpty,
  isActive,
  options,
  activeOptionId,
  onSelectRecent,
  onSelectDestination,
  onSelectCategory,
  onSelectVenue,
  onClearRecent,
  onRetry,
}: {
  listboxId: string;
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  isActive: boolean;
  options: SearchOption[];
  activeOptionId: string | null;
  onSelectRecent: (term: string) => void;
  onSelectDestination: (destinationId: string, name: string) => void;
  onSelectCategory: (value: string) => void;
  onSelectVenue: (venue: Venue) => void;
  onClearRecent: () => void;
  onRetry: () => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-1.5 p-3" role="listbox" id={listboxId}>
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-6 text-center" id={listboxId} role="listbox">
        <Icon className="text-primary" name="error_outline" size={24} />
        <p className="text-sm font-semibold text-primary">Something went wrong</p>
        <button
          className="text-sm font-semibold text-primary underline underline-offset-2"
          onClick={onRetry}
          type="button"
        >
          Retry
        </button>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center gap-1.5 px-4 py-6 text-center" id={listboxId} role="listbox">
        <Icon className="text-on-surface-variant" name="search_off" size={22} />
        <p className="text-sm text-on-surface-variant">No suggestions found</p>
      </div>
    );
  }

  if (options.length === 0) {
    // Default state with no recent searches yet — render an empty, valid
    // listbox rather than nothing, so `aria-controls` always points at a
    // real element.
    return <div className="p-2" id={listboxId} role="listbox" />;
  }

  let lastGroup: SearchOption["kind"] | null = null;

  return (
    <div className="max-h-[60vh] overflow-y-auto py-1" id={listboxId} role="listbox">
      {!isActive ? (
        <div className="flex items-center justify-between px-3 pt-2 pb-1">
          <p className="text-[11px] font-bold tracking-wider text-on-surface-variant uppercase">
            Recent Searches
          </p>
          <button className="text-xs font-semibold text-primary" onClick={onClearRecent} type="button">
            Clear All
          </button>
        </div>
      ) : null}

      {options.map((option) => {
        const showGroupLabel = isActive && option.kind !== lastGroup && option.kind !== "recent";
        lastGroup = option.kind;

        return (
          <div key={option.id}>
            {showGroupLabel ? <GroupLabel>{GROUP_LABEL[option.kind as Exclude<SearchOption["kind"], "recent">]}</GroupLabel> : null}
            {option.kind === "recent" ? (
              <OptionRow active={option.id === activeOptionId} id={option.id} onClick={() => onSelectRecent(option.term)}>
                <Icon className="shrink-0 text-on-surface-variant" name="schedule" size={18} />
                <span className="truncate text-sm text-on-surface">{option.term}</span>
              </OptionRow>
            ) : option.kind === "destination" ? (
              <OptionRow
                active={option.id === activeOptionId}
                id={option.id}
                onClick={() => onSelectDestination(option.destinationId, option.name)}
              >
                <Icon className="shrink-0 text-on-surface-variant" name="place" size={18} />
                <span className="truncate text-sm text-on-surface">{option.name}</span>
              </OptionRow>
            ) : option.kind === "category" ? (
              <OptionRow active={option.id === activeOptionId} id={option.id} onClick={() => onSelectCategory(option.value)}>
                <Icon className="shrink-0 text-on-surface-variant" name={option.icon ?? "category"} size={18} />
                <span className="truncate text-sm text-on-surface">{option.label}</span>
              </OptionRow>
            ) : (
              <OptionRow active={option.id === activeOptionId} id={option.id} onClick={() => onSelectVenue(option.venue)}>
                <Icon className="shrink-0 text-on-surface-variant" name="storefront" size={18} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-on-surface">{option.venue.name}</span>
                  <span className="block truncate text-xs text-on-surface-variant">
                    {option.venue.destinationName}
                  </span>
                </span>
              </OptionRow>
            )}
          </div>
        );
      })}
    </div>
  );
}
