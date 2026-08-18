"use client";

import { useMemo, useState } from "react";
import { TopAppBar } from "@/components/nav/TopAppBar";
import { EmptyState } from "@/components/patterns/EmptyState";
import { LoadingFade } from "@/components/patterns/LoadingFade";
import { TabBar } from "@/components/patterns/TabBar";
import { CTAButton } from "@/components/ui/CTAButton";
import { IconButton } from "@/components/ui/IconButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { VenueCard } from "@/components/venue/VenueCard";
import { useVenues } from "@/lib/hooks/useVenues";
import { useSaved } from "@/lib/saved/useSaved";

const TABS = [
  { id: "favorites", label: "Favorites" },
  { id: "collections", label: "Collections" },
  { id: "want-to-go", label: "Want to go" },
] as const;

type SortOrder = "recent" | "name";

/** Saved — device-local only (approved decision: no accounts in v1). Only
 * "Favorites" has real content; Collections and Want to Go have no
 * multi-list model behind them yet and are permanent `EmptyState`s, not
 * placeholders scheduled for a later phase.
 *
 * COASTAL EDITORIAL / STAGE 5 (F-02) — was a hand-rolled `<h1>` + sort
 * button standing in for a page header, the one root tab not using the
 * shared `TopAppBar` every sibling (Home, Explore, More) renders. That
 * divergence had no structural reason: Saved is a plain scrollable content
 * list, exactly like Home/Explore, not an immersive full-bleed surface like
 * Map (which legitimately owns its own chrome). Swapped for
 * `<TopAppBar title="Saved" />` so Saved visually belongs to the same
 * root-tab family — same avatar, same scroll-elevation behavior, same
 * chrome height.
 *
 * The sort control is real, not inert: recently-saved vs. A-Z over the
 * actual saved list. It has no slot in `TopAppBar`'s own API (deliberately
 * not modified — this is a Saved-specific control, not something every
 * root tab needs), so it now lives in its own row directly below the
 * shared header, keeping its exact previous behavior and icon swap. */
export function SavedClient() {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]["id"]>("favorites");
  const [sort, setSort] = useState<SortOrder>("recent");
  const { savedIds, isSaved, toggle } = useSaved();
  const venues = useVenues();

  const savedVenues = useMemo(() => {
    if (!venues.data) return [];
    // savedIds is already ordered most-recently-saved-first (useSaved
    // prepends on add), so "recent" is just that order re-applied after
    // the id -> venue lookup.
    const byId = new Map(venues.data.map((v) => [v.id, v]));
    const found = savedIds.map((id) => byId.get(id)).filter((v) => v !== undefined);
    return sort === "name" ? [...found].sort((a, b) => a.name.localeCompare(b.name)) : found;
  }, [venues.data, savedIds, sort]);

  return (
    <>
      <TopAppBar title="Saved" />

      {/* Stage 5 (F-01) — same `max-w-5xl` desktop framing as Home/Explore/
        * More, applied once around the sort row + tabs + list so all three
        * stay aligned to one column instead of each needing its own
        * wrapper. No-op at 390px. */}
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex items-center justify-end px-4 pt-2">
          <IconButton
            icon={sort === "recent" ? "sort" : "sort_by_alpha"}
            label={
              sort === "recent"
                ? "Sorted by recently saved — switch to A-Z"
                : "Sorted A-Z — switch to recently saved"
            }
            onClick={() => setSort((s) => (s === "recent" ? "name" : "recent"))}
            variant="plain"
          />
        </div>

        <TabBar activeId={activeTab} onChange={(id) => setActiveTab(id as typeof activeTab)} tabs={TABS} />

        <div className="px-4 pt-4">
          {activeTab !== "favorites" ? (
            <EmptyState
              action={<CTAButton href="/explore">Explore SahelSpot</CTAButton>}
              description={
                activeTab === "collections"
                  ? "Organizing saved places into collections is coming soon."
                  : "Keep a list of places you're planning to visit."
              }
              icon="bookmark_border"
              title={activeTab === "collections" ? "No collections yet" : "Nothing on your list yet"}
            />
          ) : (
            <LoadingFade
              loading={venues.isLoading}
              skeleton={
                <div className="space-y-4">
                  <Skeleton className="h-72 w-full" />
                  <Skeleton className="h-72 w-full" />
                </div>
              }
            >
              {venues.isError ? (
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
              ) : savedVenues.length === 0 ? (
                <EmptyState
                  action={<CTAButton href="/explore">Explore SahelSpot</CTAButton>}
                  description="Tap the heart on any place to save it here."
                  icon="favorite_border"
                  title="No saved places yet"
                />
              ) : (
                <div className="space-y-4">
                  {savedVenues.map((venue) => (
                    <VenueCard key={venue.id} onToggleSaved={toggle} saved={isSaved(venue.id)} venue={venue} />
                  ))}
                </div>
              )}
            </LoadingFade>
          )}
        </div>
      </div>
    </>
  );
}
