"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { TopAppBar } from "@/components/nav/TopAppBar";
import { HomeHero } from "@/components/patterns/HomeHero";
import { HomeHeroBackdrop } from "@/components/patterns/HomeHeroBackdrop";
import { EditorialBreak } from "@/components/patterns/EditorialBreak";
import { Reveal } from "@/components/patterns/Reveal";
import { CategoryChip } from "@/components/patterns/CategoryChip";
import { DockCategoryRail } from "@/components/patterns/DockCategoryRail";
import { DestinationCoverflow } from "@/components/patterns/DestinationCoverflow";
import { SectionHeader } from "@/components/patterns/SectionHeader";
import { CardCarousel } from "@/components/patterns/CardCarousel";
import { FeaturedSignatureCard } from "@/components/patterns/FeaturedSignatureCard";
import { FoodPickCard } from "@/components/patterns/FoodPickCard";
import { NightlifeCard } from "@/components/patterns/NightlifeCard";
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
   * space above this rail. `"default"` (32px, the previous blanket
   * `space-y-8` value) for the quieter standard rails — Trending, Food
   * Picks, Nightlife — left unchanged. `"tight"` (UI Polish Batch,
   * Correction Pass item 3) is Best Beaches only: sitting directly under
   * the category rail, `"default"`'s 32px read as an oversized blank gap
   * because it matched the *same* spacing every other rail already uses
   * lower down the page, so Best Beaches never visually distinguished
   * itself from "one more standard rail gap" — it just didn't feel
   * tightened. A prop rather than a wrapping `space-y-*` on `<main>`
   * because a single uniform value can't express a rhythm; this is the
   * "impact → breathing room → density" pattern the brief asks for,
   * without changing what any rail contains. */
  spacingBefore?: "default" | "tight";
  /** Best Beaches QR Removal task — passed straight through to `VenueCard`.
   * `false` (default) for Trending/Food Picks/Nightlife, unchanged. Only
   * Best Beaches sets this, so its cards drop the "QR Required"/access-
   * type pill (and the row entirely, when that pill was the only reason
   * the row existed) without touching any other rail's cards. */
  hideAccessType?: boolean;
  /** Best Beaches Gradient Frame task — passed straight through to
   * `VenueCard`. `false` (default) for every other rail, unchanged flat
   * content strip. Only Best Beaches sets this. */
  gradientFrame?: boolean;
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
  hideAccessType = false,
  gradientFrame = false,
}: VenueRailProps) {
  return (
    <Reveal className={spacingBefore === "tight" ? "mt-5" : "mt-8"}>
      <section>
        <SectionHeader actionHref={actionHref} actionLabel="See All" title={title} />
        {isLoading ? (
          <CardCarousel>
            <Skeleton className="h-64 w-[80%] min-w-[240px] shrink-0" />
            <Skeleton className="h-64 w-[80%] min-w-[240px] shrink-0" />
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
                  gradientFrame={gradientFrame}
                  hideAccessType={hideAccessType}
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

  /** COASTAL EDITORIAL MIGRATION — the two photographic moments (Hero,
   * Editorial Break) both draw from `useVenues()`, a query this screen
   * already runs for its rails. No new request, no new API field, no
   * bundled asset, no change to published data.
   *
   * Beach venues are the source because they are the one category whose
   * published cover images are reliably real coastal photography rather
   * than brand logos — which is what these two slots need. Both pick the
   * *first* beach venue with a cover image, in the catalog's own order, so
   * the choice is deterministic across renders (no `Math.random`, nothing
   * that could differ between server and client render).
   *
   * Selection is a single deterministic index on each side — the Hero
   * takes the first, the Editorial Break the last — so exactly one image
   * request is made per slot and the two are never the same photograph.
   * The Break resolves to `null` (and renders nothing) when there is only
   * one candidate to go around, rather than repeating the Hero's photo a
   * few sections later.
   *
   * Deliberately no runtime "is this image good enough" probing: an
   * earlier revision had the Hero measure each candidate's decoded width
   * and skip past small ones, which turned out to measure the served
   * variant rather than the source and cost five redundant image requests
   * per load. Photo quality is a content concern (Studio publishes some
   * low-resolution covers), not something the client can meaningfully
   * detect. */
  const coastalPhotos = useMemo(
    () => beachVenues.map((venue) => venue.coverImageUrl).filter((url): url is string => url !== null),
    [beachVenues],
  );
  const heroImageUrl = coastalPhotos[0] ?? null;
  const editorialBreakImageUrl = coastalPhotos.length > 1 ? coastalPhotos[coastalPhotos.length - 1] : null;

  function goToSearch() {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    const suffix = params.toString();
    router.push(suffix ? `/search?${suffix}` : "/search");
  }

  return (
    <div className="min-h-dvh">
      {/* Hero → Category Background Fade — extends the Home Hero/Header
        * Integration block from before: this `relative` container now
        * spans the header, the search band, AND the "What do you want to
        * do?" category section, with `HomeHeroBackdrop` supplying ONE
        * continuous background image (+ top wash + bottom fade) behind all
        * three, sized entirely by their combined in-flow height — no
        * hardcoded container height. The category section's cards/labels
        * are unchanged, just relocated here from `<main>` so they sit in
        * front of the extended photograph instead of on a flat background;
        * `px-4` moves onto the section itself since it's no longer inside
        * `<main>`'s own `px-4`, keeping the heading/rail's horizontal
        * position and `DockCategoryRail`'s `-mx-4` bleed pixel-identical.
        * `overflow-hidden` here is load-bearing, not decorative: the old
        * `HomeHero` had it on its own 176px band to clip the photo's
        * breathing `scale(1.04)` motion, which otherwise spills a few
        * pixels past the container's edges (transform doesn't affect
        * layout size, so nothing else would clip it) and produces real
        * horizontal page overflow now that the band is full-width. Doesn't
        * interfere with `DockCategoryRail`'s own `overflow-x-auto` scroll
        * below — an ancestor clipping visual overflow and a descendant's
        * own internal scroll container are independent. */}
      <div className="relative overflow-hidden">
        <HomeHeroBackdrop imageUrl={heroImageUrl} />

        <TopAppBar greeting="Good Morning" overlay title="SahelSpot" variant="greeting" />
        {/* The Stitch weather pill ("31°C Sunny") is live third-party data,
          * not published editorial content — showing invented numbers here
          * would be exactly the permanent mocking the architecture forbids.
          * Omitted per API_REQUIREMENTS.md §5 pending a Studio weather
          * proxy or an explicit decision to drop it for good; unaffected by
          * the imageless hero below, which carries no weather slot. */}
        <HomeHero
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

        {/* UI Polish Batch, Correction Pass item 3 — the real source of the
          * oversized category → Best Beaches gap wasn't this section's own
          * top margin (already a modest `mt-3`/12px against the hero), it
          * was `VenueRail`'s `spacingBefore` below: Best Beaches used
          * `"default"` (32px), the *same* gap every standard rail
          * (Trending, Food Picks, Nightlife) already carries lower down the
          * page, so it read as "one more rail gap," not a tightened
          * transition. Fixed at the source — see `spacingBefore="tight"`
          * on the `VenueRail` call below — rather than shrinking this
          * margin further, since that measured at only 12px. */}
        {/* Hero Background Extension — `pb-10` (was `pb-6`) is the backdrop's
          * own trailing coverage, not category rhythm: it doesn't touch the
          * heading→cards→labels spacing above it, it only extends how far
          * past the labels the wrapper (and therefore `HomeHeroBackdrop`,
          * sized to match) reaches before the bottom fade takes over — see
          * `.hero-category-fade` for where the fade itself now starts. */}
        <section className="relative mt-3 px-4 pb-10">
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
      </div>

      {/* Visual Richness / Art Direction Pass, item 5 — `space-y-8` (a
        * uniform 32px between every section) replaced with deliberate
        * per-section spacing below: `VenueRail`'s `spacingBefore` prop and
        * explicit `mt-*` on the sections defined inline here. A single
        * value can't express a rhythm; this can.
        *
        * UI Polish Batch, item 4 — `max-w-5xl` (which framed Home in a
        * centered column with visible side margins on wide viewports) is
        * dropped so Home's rails and hero use the full available viewport
        * width, matching Map's existing full-bleed posture. `BottomNav` and
        * the root `(root)/layout.tsx` shell were never the source of that
        * frame — it lived entirely in this `<main>` — so removing it here
        * cannot affect Map or any other root tab, none of which read this
        * class. */}
      <main className="w-full px-4">
        <VenueRail
          actionHref="/search?category=beach"
          emptyDescription="Published beaches and beach clubs will appear here."
          emptyIcon="beach_access"
          emptyTitle="No beaches yet"
          gradientFrame
          hideAccessType
          isError={venues.isError}
          isLoading={venues.isLoading}
          isSaved={isSaved}
          onRetry={() => venues.refetch()}
          onToggleSaved={toggle}
          spacingBefore="tight"
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

        {/* COASTAL EDITORIAL MIGRATION — the Editorial Break, Home's one
          * non-rail moment. Placed between Trending and Events, the longest
          * previously-unbroken run of identically-shaped carousel sections.
          * Owns its own `mt-12` and full-bleed `-mx-4` internally, so it is
          * not wrapped in `Reveal` here (it carries its own scroll reveal)
          * and needs no spacing wrapper. Renders nothing when no second
          * coastal photo exists — see the component. */}
        <EditorialBreak
          eyebrow="The North Coast"
          headline="Every beach, every table, every night out. One map."
          imageUrl={editorialBreakImageUrl}
        />

        <Reveal className="mt-12">
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

        {/* Food Picks — logo/brand discovery. A dedicated compact square
          * card (`FoodPickCard`, Home-only), not `VenueRail`'s standard
          * `VenueCard`: food content here is overwhelmingly a logo with a
          * name/destination underneath, not a photo with rating/status, so
          * the standard card's taller stack left dead white space below the
          * logo. Written inline rather than through `VenueRail` because the
          * card component itself differs, not just its size. */}
        <Reveal className="mt-8">
          <section>
            <SectionHeader actionHref="/search?category=food" actionLabel="See All" title="Food Picks" />
            {venues.isLoading ? (
              <CardCarousel>
                <Skeleton className="h-40 w-28 shrink-0" />
                <Skeleton className="h-40 w-28 shrink-0" />
                <Skeleton className="h-40 w-28 shrink-0" />
              </CardCarousel>
            ) : venues.isError ? (
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
            ) : foodVenues.length === 0 ? (
              <EmptyState
                description="Published restaurants will appear here."
                icon="restaurant"
                title="No food picks yet"
              />
            ) : (
              <CardCarousel>
                {foodVenues.map((venue) => (
                  <FoodPickCard
                    key={venue.id}
                    onToggleSaved={toggle}
                    saved={isSaved(venue.id)}
                    venue={venue}
                  />
                ))}
              </CardCarousel>
            )}
          </section>
        </Reveal>

        {/* Nightlife — atmosphere/photo discovery, deliberately the visual
          * opposite of Food Picks right above it. A dedicated moderately
          * wide, image-first card (`NightlifeCard`, Home-only) — one card
          * per venue, ~230px (≈64% of the mobile carousel width), with a
          * cinematic photo dominating the card and only name/destination
          * underneath. */}
        <Reveal className="mt-8">
          <section>
            <SectionHeader actionHref="/search?category=nightlife" actionLabel="See All" title="Nightlife" />
            {venues.isLoading ? (
              <CardCarousel>
                <Skeleton className="h-52 w-[230px] shrink-0" />
                <Skeleton className="h-52 w-[230px] shrink-0" />
              </CardCarousel>
            ) : venues.isError ? (
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
            ) : nightlifeVenues.length === 0 ? (
              <EmptyState
                description="Published nightlife spots will appear here."
                icon="nightlife"
                title="No nightlife yet"
              />
            ) : (
              <CardCarousel>
                {nightlifeVenues.map((venue) => (
                  <NightlifeCard
                    key={venue.id}
                    onToggleSaved={toggle}
                    saved={isSaved(venue.id)}
                    venue={venue}
                  />
                ))}
              </CardCarousel>
            )}
          </section>
        </Reveal>

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
    </div>
  );
}
