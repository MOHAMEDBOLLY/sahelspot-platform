"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { TopAppBar } from "@/components/nav/TopAppBar";
import { SectionHeader } from "@/components/patterns/SectionHeader";
import { QuickBrowseChip } from "@/components/patterns/QuickBrowseChip";
import { FilterChip } from "@/components/patterns/FilterChip";
import { EmptyState } from "@/components/patterns/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useVenues } from "@/lib/hooks/useVenues";
import { CATEGORIES } from "@/lib/domain/categories";
import { topTags } from "@/lib/domain/tags";
import { ACCESS_TYPES, ACCESS_TYPE_ICON } from "@/lib/domain/accessType";

/** Explore's own tag-row count — smaller than Home's Popular Tags row
 * (`POPULAR_TAG_COUNT` in HomeClient), since this screen already carries
 * three other browse rows above it; the same "don't crowd the screen"
 * reasoning Home's `MAX_TAG_RAILS` documents, applied to width instead of
 * section count. */
const EXPLORE_TAG_COUNT = 12;

/** Explore — Category/Tags/Access Type/Badges/Collections architecture
 * (Phase 2). Four parallel entry points into the same `/search` screen,
 * each along one taxonomy axis (category, tag, access type), never
 * merged into one control: a QR-gated restaurant is still a restaurant
 * and still tagged "sushi", so browsing by any one axis has to reach it.
 * Every row here links into Search with the matching query param — this
 * screen is a browse surface over Search's existing filtering, not a
 * second search implementation.
 *
 * Collections is the one taxonomy dimension that can't be wired up yet —
 * see its section below for exactly why. */
export function ExploreClient() {
  const router = useRouter();
  const venues = useVenues();
  const allVenues = useMemo(() => venues.data ?? [], [venues.data]);
  const popularTags = useMemo(() => topTags(allVenues, EXPLORE_TAG_COUNT), [allVenues]);

  return (
    <>
      <TopAppBar title="Explore" />

      <main className="space-y-8 px-4 pt-2 pb-12">
        <section>
          <SectionHeader title="Browse by Category" />
          <div className="grid grid-cols-4 gap-3">
            {CATEGORIES.filter((category) => category.showInFilters).map((category) => (
              <QuickBrowseChip
                href={`/search?category=${encodeURIComponent(category.value)}`}
                icon={category.icon}
                key={category.value}
                label={category.label}
              />
            ))}
          </div>
        </section>

        <section>
          <SectionHeader title="Browse by Tag" />
          {venues.isLoading ? (
            <div className="flex gap-2 overflow-hidden">
              <Skeleton className="h-10 w-24 shrink-0 rounded-full" />
              <Skeleton className="h-10 w-28 shrink-0 rounded-full" />
              <Skeleton className="h-10 w-20 shrink-0 rounded-full" />
            </div>
          ) : venues.isError ? (
            <p className="text-sm text-on-surface-variant">
              Couldn&apos;t load tags right now — pull down to try again.
            </p>
          ) : popularTags.length === 0 ? (
            <p className="text-sm text-on-surface-variant">
              Tags will appear here once published venues carry them.
            </p>
          ) : (
            <div className="hide-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
              {popularTags.map((tag) => (
                <FilterChip
                  icon="sell"
                  key={tag.slug}
                  label={tag.label}
                  onClick={() => router.push(`/search?tags=${encodeURIComponent(tag.slug)}`)}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <SectionHeader title="Browse by Access Type" />
          <div className="hide-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
            {ACCESS_TYPES.map((value) => (
              <FilterChip
                icon={ACCESS_TYPE_ICON[value]}
                key={value}
                label={value}
                onClick={() => router.push(`/search?accessType=${encodeURIComponent(value)}`)}
              />
            ))}
          </div>
        </section>

        <section>
          <SectionHeader title="Collections" />
          {/* Category/Tags/Access Type/Badges/Collections architecture
            * (Phase 1) — `GET /public/collections/{slug}` exists and
            * works, but there is still no `GET /public/collections` (list)
            * endpoint to discover which slugs exist
            * (docs/consumer/API_REQUIREMENTS.md §2). Scoped to just this
            * section rather than blocking the whole screen the way the
            * previous placeholder did — the rest of Explore doesn't share
            * this dependency. */}
          <EmptyState
            description="Curated collections are ready on the backend, but there's no way yet for the app to discover which ones exist — see docs/consumer/API_REQUIREMENTS.md §2."
            icon="collections_bookmark"
            title="Collections coming soon"
          />
        </section>
      </main>
    </>
  );
}
