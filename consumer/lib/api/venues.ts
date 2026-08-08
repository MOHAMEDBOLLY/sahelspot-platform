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
  category?: string;
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
 * `/public/venues` filtered client-side. */
export function searchVenues(params: VenueSearchParams): Promise<PublishedVenueDTO[]> {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.category) query.set("category", params.category);
  if (params.destination) query.set("destination", params.destination);
  if (params.tags && params.tags.length > 0) query.set("tags", params.tags.join(","));
  if (params.accessType) query.set("accessType", params.accessType);
  const suffix = query.toString();

  return apiGetList<PublishedVenueDTO>(`/public/search/venues${suffix ? `?${suffix}` : ""}`);
}
