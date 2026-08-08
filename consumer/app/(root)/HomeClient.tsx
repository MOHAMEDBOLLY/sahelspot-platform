"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { TopAppBar } from "@/components/nav/TopAppBar";
import { SearchField } from "@/components/patterns/SearchField";
import { CategoryChip } from "@/components/patterns/CategoryChip";
import { SectionHeader } from "@/components/patterns/SectionHeader";
import { CardCarousel } from "@/components/patterns/CardCarousel";
import { DestinationCard } from "@/components/destination/DestinationCard";
import { VenueCard } from "@/components/venue/VenueCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/patterns/EmptyState";
import { CTAButton } from "@/components/ui/CTAButton";
import { useVenues } from "@/lib/hooks/useVenues";
import { useDestinations } from "@/lib/hooks/useDestinations";
import { useEvents } from "@/lib/hooks/useEvents";
import { useSaved } from "@/lib/saved/useSaved";
import { FilterChip } from "@/components/patterns/FilterChip";
import { activityHref, ESSENTIAL_SERVICES, HOME_ACTIVITIES } from "@/lib/home/activities";
import { getDestinationGeoMetadata, sortDestinationsGeographically } from "@/lib/home/destinationOrder";
import { topTags, venuesWithTag } from "@/lib/domain/tags";
import type { Venue } from "@/lib/domain/venue";

/** A tag rail only earns its own section once enough venues actually carry
 * it — otherwise "Sushi Spots" for two venues reads as noise, not
 * discovery. Same reasoning `notableAccessType` (VenueCard) gives for
 * hiding the common case: a threshold that keeps a data-driven section
 * from firing on thin data. */
const MIN_TAG_RAIL_SIZE = 5;
/** Popular Tags chip row — enough to fill the scroll rail without turning
 * it into the entire tag vocabulary. */
const POPULAR_TAG_COUNT = 10;
/** At most this many dynamic "X Spots" rails per Home render — Home
 * already carries five venue rails; taxonomy should be felt, not let it
 * crowd out Trending/Explore Destinations/Events. */
const MAX_TAG_RAILS = 2;

/** Temporarily hidden per product review — the section, its data, and its
 * `lib/home/activities.ts` mapping are untouched; only its render is gated
 * off here. Flip back to `true` to restore it, no other change needed. */
const SHOW_ESSENTIAL_SERVICES = false;

type VenueRailProps = {
  title: string;
  actionHref: string;
  venues: Venue[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  emptyIcon: string;
  emptyTitle: string;
  emptyDescription: string;
  isSaved: (id: string) => boolean;
  onToggleSaved: (id: string) => void;
};

/** Home now carries four venue rails (Best Beaches, Trending, Food Picks,
 * Nightlife) that differ only by which venues they show — the loading /
 * error / empty / success handling is identical across all four and all
 * four read the same `useVenues()` query. Written once here rather than
 * copy-pasted per section; still the same `CardCarousel` + `VenueCard` +
 * `Skeleton` + `EmptyState` components each section used individually. */
function VenueRail({
  title,
  actionHref,
  venues,
  isLoading,
  isError,
  onRetry,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  isSaved,
  onToggleSaved,
}: VenueRailProps) {
  return (
    <section>
      <SectionHeader actionHref={actionHref} actionLabel="See All" title={title} />
      {isLoading ? (
        <CardCarousel>
          <Skeleton className="h-72 w-[80%] min-w-[280px] shrink-0" />
          <Skeleton className="h-72 w-[80%] min-w-[280px] shrink-0" />
        </CardCarousel>
      ) : isError ? (
        <EmptyState
          action={
            <CTAButton onClick={onRetry} variant="secondary">
              Retry
            </CTAButton>
          }
          description="We couldn't reach SahelSpot Studio. Check your connection and try again."
          icon="error_outline"
          title="Something went wrong"
        />
      ) : venues.length === 0 ? (
        <EmptyState description={emptyDescription} icon={emptyIcon} title={emptyTitle} />
      ) : (
        <CardCarousel>
          {venues.map((venue) => (
            <VenueCard
              key={venue.id}
              onToggleSaved={onToggleSaved}
              saved={isSaved(venue.id)}
              venue={venue}
            />
          ))}
        </CardCarousel>
      )}
    </section>
  );
}

/** Home — the first complete screen, and the validation of Phases 0-3.
 *
 * Every data-backed section carries all four states (loading / error / empty
 * / success) independently, rather than gating the whole page behind one
 * spinner: the sections have separate queries and no reason to fail or empty
 * together.
 *
 * The navigation is editorial, not structural: "What do you want to do
 * today?" lists activities someone plans a day around, and each one resolves
 * to real Studio categories in `lib/home/activities.ts` — the only place
 * that mapping exists. Beaches appears both as an activity (navigation) and
 * as the Best Beaches rail (recommendations); those answer different
 * questions and deliberately share the same underlying data.
 *
 * "Trending Today" reuses the one real editorial signal that exists —
 * `isFeatured` — rather than inventing an algorithm or adding analytics. */
export function HomeClient() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const venues = useVenues();
  const destinations = useDestinations();
  const events = useEvents();
  const { isSaved, toggle } = useSaved();

  const allVenues = useMemo(() => venues.data ?? [], [venues.data]);

  /** Geographic order (Alexandria -> Marsa Matrouh), not the API's default
   * alphabetical order — see `lib/home/destinationOrder.ts` for how this
   * order and the kilometer markers below were derived. */
  const orderedDestinations = useMemo(
    () => sortDestinationsGeographically(destinations.data ?? []),
    [destinations.data],
  );

  /** Rails filter the already-mapped domain category — the same client-side
   * shape `MapClient` already uses over this same `useVenues()` query, not a
   * second filtering mechanism and not an extra request per rail. */
  const featuredVenues = useMemo(
    () => allVenues.filter((venue) => venue.isFeatured),
    [allVenues],
  );
  const beachVenues = useMemo(
    () => allVenues.filter((venue) => venue.category === "beach"),
    [allVenues],
  );
  const foodVenues = useMemo(
    () => allVenues.filter((venue) => venue.category === "food"),
    [allVenues],
  );
  const nightlifeVenues = useMemo(
    () => allVenues.filter((venue) => venue.category === "nightlife"),
    [allVenues],
  );

  /** Category/Tags/Access Type/Badges/Collections architecture (Phase 1) —
   * Home's taxonomy discovery surface. `popularTags` drives the chip row;
   * `tagRails` turns the biggest of those tags (past `MIN_TAG_RAIL_SIZE`)
   * into their own "X Spots" rails, reusing `VenueRail` exactly like
   * Best Beaches/Food Picks/Nightlife already do for `category` — tags are
   * just a second, complementary axis over the same venue list, not a
   * parallel mechanism. */
  const popularTags = useMemo(() => topTags(allVenues, POPULAR_TAG_COUNT), [allVenues]);
  const tagRails = useMemo(
    () =>
      popularTags
        .filter((tag) => tag.count >= MIN_TAG_RAIL_SIZE)
        .slice(0, MAX_TAG_RAILS)
        .map((tag) => ({ tag, venues: venuesWithTag(allVenues, tag.slug) })),
    [popularTags, allVenues],
  );

  /** Events already carry a server-computed `phase`; "upcoming" here means
   * anything not already over, so a festival running today still shows. */
  const upcomingEvents = useMemo(
    () => (events.data ?? []).filter((event) => event.phase !== "ended"),
    [events.data],
  );

  function goToSearch() {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    const suffix = params.toString();
    router.push(suffix ? `/search?${suffix}` : "/search");
  }

  return (
    <>
      <TopAppBar greeting="Good Morning" title="SahelSpot" variant="greeting" />

      <main className="space-y-8 px-4 pt-2">
        {/* `justify-between` on a single-child row today — reserved for the
          * future Home Hero Weather Widget (temperature + Beach Flag status
          * only, tap-through to the future Beach Weather screen; see
          * docs/consumer/BEACH_WEATHER_SPEC.md §10 and
          * docs/consumer/MOBILE_2027_DESIGN_FREEZE.md §10). Nothing renders
          * in this slot yet — planning only, not implemented. */}
        <section className="flex items-center justify-between gap-4">
          <h1 className="font-headline text-4xl leading-tight font-bold tracking-tight text-primary whitespace-nowrap">
            North Coast
          </h1>
          {/* The Stitch weather pill ("31°C Sunny") is live third-party data,
            * not published editorial content — showing invented numbers here
            * would be exactly the permanent mocking the architecture forbids.
            * Omitted per API_REQUIREMENTS.md §5 pending a Studio weather
            * proxy or an explicit decision to drop it for good. */}
        </section>

        <section>
          <SearchField
            onChange={(event) => setQuery(event.target.value)}
            onFilterClick={() => router.push("/search")}
            onKeyDown={(event) => {
              if (event.key === "Enter") goToSearch();
            }}
            placeholder="Search destinations, venues & events..."
            value={query}
          />
        </section>

        <section>
          <SectionHeader
            actionHref="/search"
            actionLabel="See All"
            title="What do you want to do?"
          />
          {/* Plain scroll rail, deliberately not `CardCarousel`: activities
            * are lightweight navigation chips, not featured content — no
            * scroll-linked scaling/focus effect, just `overflow-x-auto` +
            * scroll-snap + a hidden scrollbar, the same three CSS
            * mechanisms `CardCarousel` itself sits on top of, without its
            * JS or its visual treatment. */}
          {/* `scroll-pl-4` matches the row's own `px-4`: without it, the
            * browser's scroll-snap resting position for the first item
            * lands 16px into the row (the padding width) instead of at
            * true `scrollLeft: 0`, clipping the first tile against the
            * screen edge on load instead of aligning it with the search
            * bar and section title above. */}
          <div className="hide-scrollbar -mx-4 flex snap-x scroll-pl-4 gap-3 overflow-x-auto px-4 pb-2">
            {HOME_ACTIVITIES.map((activity) => (
              <div className="w-16 shrink-0 snap-start" key={activity.id}>
                <CategoryChip
                  icon={activity.icon}
                  label={activity.label}
                  onClick={() => router.push(activityHref(activity))}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Category/Tags/Access Type/Badges/Collections architecture
          * (Phase 1/2) — the taxonomy discovery surface: real tag slugs
          * observed across published venues (`lib/domain/tags.ts`), never
          * hardcoded, most-popular first. Same `FilterChip` component
          * Search's own filter rows already use, so tapping one and
          * landing on Search's matching, already-active chip is one
          * continuous interaction, not two different controls for the
          * same idea. Omitted entirely (not shown empty) once the catalog
          * has fewer tags than would fill a scroll row worth showing. */}
        {popularTags.length > 0 ? (
          <section>
            <SectionHeader actionHref="/search" actionLabel="See All" title="Popular Tags" />
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
          </section>
        ) : null}

        <VenueRail
          actionHref="/search?category=Beach%20Club"
          emptyDescription="Published beaches and beach clubs will appear here."
          emptyIcon="beach_access"
          emptyTitle="No beaches yet"
          isError={venues.isError}
          isLoading={venues.isLoading}
          isSaved={isSaved}
          onRetry={() => venues.refetch()}
          onToggleSaved={toggle}
          title="Best Beaches"
          venues={beachVenues}
        />

        {/* Dynamic tag rails — the "Sushi Spots"/"Seafood Spots" style
          * section the taxonomy work exists to enable, generated from
          * whichever tags are actually popular in the current publish
          * snapshot rather than a fixed editorial list (see `tagRails`
          * above). Reuses `VenueRail` verbatim: a tag rail and a category
          * rail (Best Beaches) are the same shape of section over the same
          * `Venue[]`, just filtered along a different taxonomy axis. */}
        {tagRails.map(({ tag, venues: tagVenues }) => (
          <VenueRail
            actionHref={`/search?tags=${encodeURIComponent(tag.slug)}`}
            emptyDescription={`Published spots tagged ${tag.label} will appear here.`}
            emptyIcon="sell"
            emptyTitle={`No ${tag.label} spots yet`}
            isError={venues.isError}
            isLoading={venues.isLoading}
            isSaved={isSaved}
            key={tag.slug}
            onRetry={() => venues.refetch()}
            onToggleSaved={toggle}
            title={`${tag.label} Spots`}
            venues={tagVenues}
          />
        ))}

        <section>
          <SectionHeader actionHref="/coming-soon?feature=destinations" actionLabel="See All" title="Explore Destinations" />
          {destinations.isLoading ? (
            <CardCarousel>
              <Skeleton className="h-64 w-[43%] min-w-[160px] shrink-0" />
              <Skeleton className="h-64 w-[43%] min-w-[160px] shrink-0" />
              <Skeleton className="h-64 w-[43%] min-w-[160px] shrink-0" />
            </CardCarousel>
          ) : destinations.isError ? (
            <EmptyState
              action={
                <CTAButton onClick={() => destinations.refetch()} variant="secondary">
                  Retry
                </CTAButton>
              }
              description="We couldn't reach SahelSpot Studio. Check your connection and try again."
              icon="error_outline"
              title="Something went wrong"
            />
          ) : orderedDestinations.length === 0 ? (
            <EmptyState
              description="Published destinations will appear here."
              icon="map"
              title="No destinations yet"
            />
          ) : (
            <CardCarousel>
              {orderedDestinations.map((destination) => (
                <div className="w-[43%] min-w-[160px] shrink-0 snap-start" key={destination.id}>
                  <DestinationCard
                    href={`/search?destination=${destination.id}`}
                    imageUrl={destination.coverImageUrl}
                    kilometerMarker={getDestinationGeoMetadata(destination.id)?.kilometerMarker ?? null}
                    name={destination.name}
                    placeCount={destination.venueCount}
                  />
                </div>
              ))}
            </CardCarousel>
          )}
        </section>

        <VenueRail
          actionHref="/coming-soon?feature=trending"
          emptyDescription="Check back soon for what's popular right now."
          emptyIcon="local_fire_department"
          emptyTitle="Nothing trending yet"
          isError={venues.isError}
          isLoading={venues.isLoading}
          isSaved={isSaved}
          onRetry={() => venues.refetch()}
          onToggleSaved={toggle}
          title="Trending"
          venues={featuredVenues}
        />

        <section>
          <SectionHeader actionHref="/events" actionLabel="See All" title="Upcoming Events" />
          {events.isLoading ? (
            <CardCarousel>
              <Skeleton className="h-72 w-[80%] min-w-[280px] shrink-0" />
              <Skeleton className="h-72 w-[80%] min-w-[280px] shrink-0" />
            </CardCarousel>
          ) : events.isError ? (
            <EmptyState
              action={
                <CTAButton onClick={() => events.refetch()} variant="secondary">
                  Retry
                </CTAButton>
              }
              description="We couldn't reach SahelSpot Studio. Check your connection and try again."
              icon="error_outline"
              title="Something went wrong"
            />
          ) : upcomingEvents.length === 0 ? (
            <EmptyState
              description="Published events will appear here."
              icon="event"
              title="No upcoming events"
            />
          ) : (
            <CardCarousel>
              {upcomingEvents.map((event) => (
                <div className="w-[80%] min-w-[280px] shrink-0 snap-start" key={event.id}>
                  <VenueCard event={event} variant="event" />
                </div>
              ))}
            </CardCarousel>
          )}
        </section>

        <VenueRail
          actionHref="/search?category=Restaurant"
          emptyDescription="Published restaurants will appear here."
          emptyIcon="restaurant"
          emptyTitle="No food picks yet"
          isError={venues.isError}
          isLoading={venues.isLoading}
          isSaved={isSaved}
          onRetry={() => venues.refetch()}
          onToggleSaved={toggle}
          title="Food Picks"
          venues={foodVenues}
        />

        <VenueRail
          actionHref="/search?category=Nightlife"
          emptyDescription="Published nightlife spots will appear here."
          emptyIcon="nightlife"
          emptyTitle="No nightlife yet"
          isError={venues.isError}
          isLoading={venues.isLoading}
          isSaved={isSaved}
          onRetry={() => venues.refetch()}
          onToggleSaved={toggle}
          title="Nightlife"
          venues={nightlifeVenues}
        />

        {SHOW_ESSENTIAL_SERVICES && (
          <section>
            <SectionHeader title="Essential Services" />
            <div className="grid grid-cols-3 gap-3">
              {ESSENTIAL_SERVICES.map((service) => (
                <CategoryChip
                  icon={service.icon}
                  key={service.id}
                  label={service.label}
                  onClick={() => router.push(activityHref(service))}
                />
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
