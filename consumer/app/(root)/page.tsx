"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { useSaved } from "@/lib/saved/useSaved";

/** Home's mood grid, read from the export ("What are you in the mood for?").
 * `category` feeds `/search?category=` — Search's own filter is a free-text
 * string, not the map's closed `VenueCategory` union, so "event" is a
 * legitimate value here even though it isn't a marker colour. */
const MOOD_CATEGORIES = [
  { icon: "beach_access", label: "Beaches", category: "beach" },
  { icon: "restaurant", label: "Food", category: "food" },
  { icon: "coffee", label: "Coffee", category: "coffee" },
  { icon: "nightlife", label: "Night", category: "nightlife" },
  { icon: "event", label: "Events", category: "event" },
] as const;

/** Home — the first complete screen, and the validation of Phases 0-3.
 *
 * Every data-backed section carries all four states (loading / error / empty
 * / success) independently, rather than gating the whole page behind one
 * spinner: the sections have separate queries and no reason to fail or empty
 * together.
 *
 * Two sections in the Stitch export have no content model behind them at
 * all, and are handled differently on purpose:
 *
 * - "Trending Today" reuses the one real signal that exists — `isFeatured` —
 *   rather than inventing one. Still a real field, not a mock.
 * - "Hidden Gems" has no field of any kind to key off (API_REQUIREMENTS.md
 *   §3 covers Trending; Hidden Gems isn't even proposed a fallback there),
 *   so it is omitted entirely rather than showing fabricated content. */
export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const venues = useVenues();
  const destinations = useDestinations();
  const { isSaved, toggle } = useSaved();

  const featuredVenues = venues.data?.filter((venue) => venue.isFeatured) ?? [];

  function goToSearch() {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    const suffix = params.toString();
    router.push(suffix ? `/search?${suffix}` : "/search");
  }

  return (
    <>
      <TopAppBar greeting="Good Morning 👋" title="SahelSpot" variant="greeting" />

      <main className="space-y-8 px-4 pt-2">
        <section>
          <h2 className="text-4xl font-extrabold tracking-tighter text-primary">
            North Coast
          </h2>
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
            placeholder="Search for places, beaches, cafes..."
            value={query}
          />
        </section>

        <section>
          <SectionHeader actionHref="/search" actionLabel="See All" title="What are you in the mood for?" />
          <div className="grid grid-cols-5 gap-3">
            {MOOD_CATEGORIES.map((mood) => (
              <CategoryChip
                icon={mood.icon}
                key={mood.category}
                label={mood.label}
                onClick={() => router.push(`/search?category=${mood.category}`)}
              />
            ))}
          </div>
        </section>

        <section>
          <SectionHeader actionHref="/coming-soon?feature=trending" actionLabel="See All" title="Trending Today" />
          {venues.isLoading ? (
            <div className="flex gap-4 overflow-hidden">
              <Skeleton className="h-64 w-[80%] min-w-[280px] shrink-0" />
              <Skeleton className="h-64 w-[80%] min-w-[280px] shrink-0" />
            </div>
          ) : venues.isError ? (
            <EmptyState
              action={<CTAButton onClick={() => venues.refetch()} variant="secondary">Retry</CTAButton>}
              description="We couldn't reach SahelSpot Studio. Check your connection and try again."
              icon="error_outline"
              title="Something went wrong"
            />
          ) : featuredVenues.length === 0 ? (
            <EmptyState
              description="Check back soon for what's popular right now."
              icon="local_fire_department"
              title="Nothing trending yet"
            />
          ) : (
            <CardCarousel>
              {featuredVenues.map((venue) => (
                <VenueCard
                  key={venue.id}
                  onToggleSaved={toggle}
                  saved={isSaved(venue.id)}
                  venue={venue}
                />
              ))}
            </CardCarousel>
          )}
        </section>

        <section>
          <SectionHeader actionHref="/coming-soon?feature=destinations" actionLabel="See All" title="Explore Destinations" />
          {destinations.isLoading ? (
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-64" />
              <Skeleton className="h-64" />
            </div>
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
          ) : (destinations.data?.length ?? 0) === 0 ? (
            <EmptyState
              description="Published destinations will appear here."
              icon="map"
              title="No destinations yet"
            />
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {destinations.data?.map((destination) => (
                <DestinationCard
                  href={`/search?destination=${destination.id}`}
                  imageUrl={null}
                  key={destination.id}
                  name={destination.name}
                  placeCount={destination.venueCount}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
