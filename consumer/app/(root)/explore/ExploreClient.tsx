"use client";

import { useRouter } from "next/navigation";
import { TopAppBar } from "@/components/nav/TopAppBar";
import { SectionHeader } from "@/components/patterns/SectionHeader";
import { QuickBrowseChip } from "@/components/patterns/QuickBrowseChip";
import { FilterChip } from "@/components/patterns/FilterChip";
import { EmptyState } from "@/components/patterns/EmptyState";
import { CATEGORIES } from "@/lib/domain/categories";
import { ACCESS_TYPES, ACCESS_TYPE_ICON } from "@/lib/domain/accessType";
import { ESSENTIALS_GROUPS } from "@/lib/home/activities";

/** Explore — Category/Tags/Access Type/Badges/Collections architecture
 * (Phase 2/3). Two parallel entry points into the same `/search` screen —
 * category and access type — each linking in with the matching query
 * param; this screen is a browse surface over Search's existing
 * filtering, not a second search implementation.
 *
 * No "Browse by Tag" row here, deliberately: tags are category-scoped
 * (`lib/domain/tags.ts`'s `topTags` is always called against a single
 * category's venues, see `SearchClient`), not a fixed global vocabulary a
 * top-level browse grid could show without picking a category first —
 * showing every tag across every category in one flat row is exactly the
 * "global taxonomy" mixing this screen must not reintroduce. Tag discovery
 * lives inside Search, once a category scopes it.
 *
 * Collections is the one taxonomy dimension that can't be wired up yet —
 * see its section below for exactly why. */
export function ExploreClient() {
  const router = useRouter();

  return (
    <>
      <TopAppBar title="Explore" />

      <main className="space-y-8 px-4 pt-2 pb-12">
        <section>
          <SectionHeader title="Browse by Category" />
          <div className="grid grid-cols-4 gap-3">
            {CATEGORIES.filter((category) => category.showInFilters).map((category) => {
              // Essentials' Home tile (`lib/home/activities.ts`) lands here
              // rather than a dedicated screen — Shopping/Services already
              // have their own chip in this existing grid, so the only
              // thing added is the `activity` param that lets Search apply
              // their V1 tag allow-list (see `findAllowedTags`). Every
              // other category chip is untouched.
              const essentialsGroup = ESSENTIALS_GROUPS.find(
                (group) => group.category === category.value,
              );
              const params = new URLSearchParams({ category: category.value });
              if (essentialsGroup) params.set("activity", essentialsGroup.id);
              return (
                <QuickBrowseChip
                  href={`/search?${params.toString()}`}
                  icon={category.icon}
                  key={category.value}
                  label={category.label}
                />
              );
            })}
          </div>
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
            description="Curated collections are on their way — check back soon."
            icon="collections_bookmark"
            title="Collections coming soon"
          />
        </section>
      </main>
    </>
  );
}
