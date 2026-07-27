import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { Button } from "@/components/Button";
import { VenueCard } from "@/components/VenueCard";
import { searchPublishedVenues } from "@/lib/api";

// Mirrors the fixed category list enforced by the API's CHECK constraint
// (api/app/db/models.py VENUE_CATEGORIES) — same reasoning as
// `datalab-next`'s own venueCategories.ts.
const VENUE_CATEGORIES = [
  "Restaurant",
  "Cafe",
  "Hotel",
  "Beach",
  "Nightlife",
  "Shopping",
  "Services",
  "Entertainment",
  "Other",
] as const;

export const metadata: Metadata = {
  title: "Search — SahelSpot",
};

type SearchPageProps = {
  searchParams: Promise<{ q?: string; category?: string }>;
};

/** M8 — a plain `<form method="GET">` submitting to this same page, not a
 * client component with `onChange` handlers: the URL's own query params
 * (`?q=&category=`) are the entire state this page needs, so a native
 * form submission (zero JavaScript) is enough to drive it. The page stays
 * a Server Component end to end — no `"use client"` anywhere in this
 * feature. */
export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q, category } = await searchParams;

  let venues: Awaited<ReturnType<typeof searchPublishedVenues>> = [];
  let unavailable = false;

  try {
    venues = await searchPublishedVenues({ q, category });
  } catch {
    unavailable = true;
  }

  const hasQuery = Boolean(q || category);

  return (
    <Container>
      <div className="py-12">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Search</h1>

        <form method="GET" className="mt-6 flex flex-col gap-3 sm:flex-row">
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search venues…"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
          <select
            name="category"
            defaultValue={category ?? ""}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
          >
            <option value="">All categories</option>
            {VENUE_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <Button type="submit">Search</Button>
        </form>

        <div className="mt-8">
          {unavailable && (
            <p className="text-sm text-gray-500">Search is unavailable right now.</p>
          )}

          {!unavailable && venues.length === 0 && (
            <p className="text-sm text-gray-500">
              {hasQuery ? "No venues match your search." : "Enter a search term or choose a category."}
            </p>
          )}

          {!unavailable && venues.length > 0 && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {venues.map((venue) => (
                <VenueCard key={venue.id} venue={venue} />
              ))}
            </div>
          )}
        </div>
      </div>
    </Container>
  );
}
