import { apiGetList, apiGetOrNull } from "./client";
import type { PublishedVenueDTO } from "./dto";

export function fetchVenues(): Promise<PublishedVenueDTO[]> {
  return apiGetList<PublishedVenueDTO>("/public/venues");
}

export function fetchVenue(venueId: string): Promise<PublishedVenueDTO | null> {
  return apiGetOrNull<PublishedVenueDTO>(`/public/venues/${encodeURIComponent(venueId)}`);
}

export type VenueSearchParams = {
  q?: string;
  destination?: string;
  /** Comma-joined tag slugs — OR semantics on the backend (a venue matches
   * if it carries any one of them), matching `/public/search/venues`'s own
   * `tags` param exactly (api/app/api/routes/search.py). */
  tags?: string[];
  /** Exact match, e.g. `"Public"`, `"QR Required"` — see
   * `lib/domain/accessType.ts`. Sent as `accessType` on the wire, matching
   * the backend's query alias. */
  accessType?: string;
};

/** Calls the dedicated `/public/search/venues` endpoint — never
 * `/public/venues` filtered client-side.
 *
 * Deliberately no `category` param here, unlike `q`/`destination`/`tags`/
 * `accessType`: the backend's `category` filter matches the *raw* Studio
 * string exactly (`"Beach Club"`, `"Restaurant"`, ...), but the Consumer's
 * category chips are the simplified 9-value domain taxonomy
 * (`lib/domain/categories.ts`'s `beach`/`food`/`coffee`/...) — sending
 * `category=beach` against `"Beach Club"` never matches anything (verified
 * live: 0 results for every domain bucket). There's also no clean 1:1
 * mapping back to a single raw value — `hotel` alone covers both `"Hotel"`
 * and `"Resort"`. `SearchClient` filters by the already-mapped domain
 * `Venue.category` client-side instead, the same way it already has to for
 * `reservationPolicy` (no server-side filter exists for that either). */
export function searchVenues(params: VenueSearchParams, signal?: AbortSignal): Promise<PublishedVenueDTO[]> {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.destination) query.set("destination", params.destination);
  if (params.tags && params.tags.length > 0) query.set("tags", params.tags.join(","));
  if (params.accessType) query.set("accessType", params.accessType);
  const suffix = query.toString();

  return apiGetList<PublishedVenueDTO>(`/public/search/venues${suffix ? `?${suffix}` : ""}`, signal);
}
