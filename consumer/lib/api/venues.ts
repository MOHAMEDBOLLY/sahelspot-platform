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
};

/** Calls the dedicated `/public/search/venues` endpoint — never
 * `/public/venues` filtered client-side. */
export function searchVenues(params: VenueSearchParams): Promise<PublishedVenueDTO[]> {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.category) query.set("category", params.category);
  if (params.destination) query.set("destination", params.destination);
  const suffix = query.toString();

  return apiGetList<PublishedVenueDTO>(`/public/search/venues${suffix ? `?${suffix}` : ""}`);
}
