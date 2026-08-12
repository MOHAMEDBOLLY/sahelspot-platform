"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { TopAppBar } from "@/components/nav/TopAppBar";
import { HomeHero } from "@/components/patterns/HomeHero";
import { Reveal } from "@/components/patterns/Reveal";
import { CategoryChip } from "@/components/patterns/CategoryChip";
import { DockCategoryRail } from "@/components/patterns/DockCategoryRail";
import { DestinationCoverflow } from "@/components/patterns/DestinationCoverflow";
import { SectionHeader } from "@/components/patterns/SectionHeader";
import { CardCarousel } from "@/components/patterns/CardCarousel";
import { FeaturedSignatureCard } from "@/components/patterns/FeaturedSignatureCard";
import { DestinationCard } from "@/components/destination/DestinationCard";
import { VenueCard } from "@/components/venue/VenueCard";
import { CATEGORY_BY_VALUE } from "@/lib/domain/categories";
import { formatEventDateRange } from "@/lib/domain/formatEventDate";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/patterns/EmptyState";
import { CTAButton } from "@/components/ui/CTAButton";
import { useVenues } from "@/lib/hooks/useVenues";
import { useDestinations } from "@/lib/hooks/useDestinations";
import { useEvents } from "@/lib/hooks/useEvents";
import { useSaved } from "@/lib/saved/useSaved";
import { activityHref, ESSENTIAL_SERVICES, HOME_ACTIVITIES } from "@/lib/home/activities";
import { getDestinationGeoMetadata, sortDestinationsGeographically } from "@/lib/home/destinationOrder";
import type { Venue } from "@/lib/domain/venue";

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
  /** Renders the rail's first venue as `FeaturedSignatureCard` instead of
   * the standard `VenueCard` — Premium Hybrid item 4, used only for Best
   * Beaches (per the implementation brief: "selectively, for Beaches and
   * Events", not every rail). The remaining venues keep the standard card
   * unchanged. */
  featureFirst?: boolean;
  /** Visual Richness / Art Direction Pass, item 5 (visual rhythm) — the
   * space above this rail. `"lg"` (40px) for the one or two "impact"
   * rails (Best Beaches), `"default"` (32px, the previous blanket
   * `space-y-8` value) for the quieter standard rails — Trending, Food
   * Picks, Nightlife. A prop rather than a wrapping `space-y-*` on `<main>`
   * because a single uniform value can't express a rhythm; this is the
   * "impact → breathing room → density" pattern the brief asks for,
   * without changing what any rail contains. */
  spacingBefore?: "default" | "lg";
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
  featureFirst = false,
  spacingBefore = "default",
}: VenueRailProps) {
  return (
    <Reveal className={spacingBefore === "lg" ? "mt-10" : "mt-8"}>
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
            {venues.map((venue, index) =>
              featureFirst && index === 0 ? (
                <FeaturedSignatureCard
                  chipLabel={CATEGORY_BY_VALUE[venue.category]?.label ?? null}
                  href={`/venues/${venue.id}`}
                  imageUrl={venue.coverImageUrl}
                  key={venue.id}
                  locationLabel={venue.destinationName}
                  rating={venue.rating}
                  reviewCount={venue.reviewCount}
                  saveable={{ id: venue.id, saved: isSaved(venue.id), onToggleSaved }}
                  title={venue.name}
                />
              ) : (
                <VenueCard
                  key={venue.id}
                  onToggleSaved={onToggleSaved}
                  saved={isSaved(venue.id)}
                  venue={venue}
                />
              ),
            )}
          </CardCarousel>
        )}
      </section>
    </Reveal>
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

      {/* Visual Richness / Art Direction Pass, item 5 — `space-y-8` (a
        * uniform 32px between every section) replaced with deliberate
        * per-section spacing below: `VenueRail`'s `spacingBefore` prop and
        * explicit `mt-*` on the sections defined inline here. A single
        * value can't express a rhythm; this can. */}
      <main className="px-4 pt-2">
        {/* The Stitch weather pill ("31°C Sunny") is live third-party data,
          * not published editorial content — showing invented numbers here
          * would be exactly the permanent mocking the architecture forbids.
          * Omitted per API_REQUIREMENTS.md §5 pending a Studio weather
          * proxy or an explicit decision to drop it for good; unaffected by
          * the imageless hero below, which carries no weather slot. */}
        <HomeHero
          destinationCount={orderedDestinations.length || null}
          searchProps={{
            onChange: (event) => setQuery(event.target.value),
            onFilterClick: () => router.push("/search"),
            onKeyDown: (event) => {
              if (event.key === "Enter") goToSearch();
            },
            placeholder: "Search destinations, venues & events...",
            value: query,
          }}
        />

        <section className="mt-8">
          <SectionHeader
            actionHref="/search"
            actionLabel="See All"
            title="What do you want to do?"
          />
          {/* Dock Interaction (Visual Richness pass) — same rail, same nine
            * `HOME_ACTIVITIES`, same `activityHref` routing as before;
            * `DockCategoryRail` only changed the wrapper around each
            * existing `CategoryChip`. `scroll-pl-4`/bleed/snap behavior all
            * live inside that component now, unchanged from what this
            * `<div>` used to do directly. */}
          <DockCategoryRail
            activities={HOME_ACTIVITIES}
            onSelect={(activity) => router.push(activityHref(activity))}
          />
        </section>

        <VenueRail
          actionHref="/search?category=beach"
          emptyDescription="Published beaches and beach clubs will appear here."
          emptyIcon="beach_access"
          emptyTitle="No beaches yet"
          featureFirst
          isError={venues.isError}
          isLoading={venues.isLoading}
          isSaved={isSaved}
          onRetry={() => venues.refetch()}
          onToggleSaved={toggle}
          spacingBefore="lg"
          title="Best Beaches"
          venues={beachVenues}
        />

        <Reveal className="mt-12">
        <section>
          <SectionHeader actionHref="/coming-soon?feature=destinations" actionLabel="See All" size="lg" title="Explore Destinations" />
          {destinations.isLoading ? (
            <CardCarousel gap="lg">
              <Skeleton className="h-60 w-64 shrink-0" />
              <Skeleton className="h-60 w-64 shrink-0" />
              <Skeleton className="h-60 w-64 shrink-0" />
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
            // 21st.dev Coverflow Carousel integration — same
            // `DestinationCard` elements, same data, same routes as the
            // plain `CardCarousel` this replaced; `DestinationCoverflow`
            // only changes how they're arranged/transformed. Falls back to
            // that exact plain-row behavior itself under reduced motion.
            <DestinationCoverflow>
              {orderedDestinations.map((destination) => (
                <DestinationCard
                  href={`/search?destination=${destination.id}`}
                  imageUrl={destination.coverImageUrl}
                  key={destination.id}
                  kilometerMarker={getDestinationGeoMetadata(destination.id)?.kilometerMarker ?? null}
                  name={destination.name}
                  placeCount={destination.venueCount}
                />
              ))}
            </DestinationCoverflow>
          )}
        </section>
        </Reveal>

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

        <Reveal className="mt-10">
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
              {upcomingEvents.map((event, index) =>
                index === 0 ? (
                  <FeaturedSignatureCard
                    chipLabel={formatEventDateRange(event)}
                    chipTone="coral"
                    href={`/events/${event.slug}`}
                    imageUrl={event.coverImageUrl}
                    key={event.id}
                    locationLabel={event.venue?.name ?? event.destination?.name ?? null}
                    title={event.title}
                  />
                ) : (
                  <div className="w-[80%] min-w-[280px] shrink-0 snap-start" key={event.id}>
                    <VenueCard event={event} variant="event" />
                  </div>
                ),
              )}
            </CardCarousel>
          )}
        </section>
        </Reveal>

        <VenueRail
          actionHref="/search?category=food"
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
          actionHref="/search?category=nightlife"
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
          <section className="mt-8">
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
