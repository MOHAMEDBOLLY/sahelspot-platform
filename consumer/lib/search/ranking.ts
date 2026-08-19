import type { Venue } from "@/lib/domain/venue";

/** Deterministic client-side ranking over an already-fetched, unranked
 * `/public/search/venues` response — audit §9/§17. No popularity or
 * analytics signal exists on `Venue`, so none is fabricated here; the only
 * real signal beyond text match is `isFeatured`, used as a tie-break only. */
function matchRank(name: string, query: string): 0 | 1 | 2 | 3 {
  const normalizedName = name.trim().toLowerCase();
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return 3;
  if (normalizedName === normalizedQuery) return 0;
  if (normalizedName.startsWith(normalizedQuery)) return 1;
  if (normalizedName.includes(normalizedQuery)) return 2;
  return 3;
}

export function rankVenuesByName(venues: Venue[], query: string): Venue[] {
  return [...venues]
    .map((venue) => ({ venue, rank: matchRank(venue.name, query) }))
    .filter((entry) => entry.rank < 3)
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      if (a.venue.isFeatured !== b.venue.isFeatured) return a.venue.isFeatured ? -1 : 1;
      return a.venue.name.localeCompare(b.venue.name);
    })
    .map((entry) => entry.venue);
}
