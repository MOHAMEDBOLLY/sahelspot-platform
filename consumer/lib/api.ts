import type { PublishedDestination, PublishedVenue } from "./types";

/** Only ever calls `/public/*` — this app has no authentication and must
 * never call `/editor/*`. Base URL matches `datalab-next`'s
 * `VITE_API_BASE_URL` convention, just under Next.js's `NEXT_PUBLIC_`
 * prefix. */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export class ApiError extends Error {}

async function apiGet<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`);
  } catch {
    throw new ApiError(`Could not reach the API (${path}).`);
  }

  if (!response.ok) {
    throw new ApiError(`${path} failed with status ${response.status}.`);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(`${path} returned a response that wasn't valid JSON.`);
  }

  return data as T;
}

export async function fetchPublishedDestinations(): Promise<PublishedDestination[]> {
  const data = await apiGet<unknown>("/public/destinations");
  if (!Array.isArray(data)) {
    throw new ApiError("/public/destinations returned an unexpected shape.");
  }
  return data as PublishedDestination[];
}

export async function fetchPublishedVenues(): Promise<PublishedVenue[]> {
  const data = await apiGet<unknown>("/public/venues");
  if (!Array.isArray(data)) {
    throw new ApiError("/public/venues returned an unexpected shape.");
  }
  return data as PublishedVenue[];
}

export type VenueSearchParams = {
  q?: string;
  category?: string;
};

/** M8 — calls the dedicated `/public/search/venues` endpoint (M7), never
 * `/public/venues` filtered client-side. */
export async function searchPublishedVenues(params: VenueSearchParams): Promise<PublishedVenue[]> {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.category) query.set("category", params.category);
  const suffix = query.toString();

  const data = await apiGet<unknown>(`/public/search/venues${suffix ? `?${suffix}` : ""}`);
  if (!Array.isArray(data)) {
    throw new ApiError("/public/search/venues returned an unexpected shape.");
  }
  return data as PublishedVenue[];
}

/** Not built on `apiGet` — a single-venue lookup has a real "not found"
 * state (`404`) that isn't an error to handle, it's the expected result
 * for an unpublished/nonexistent id (see docs/adr/0001-public-venue-urls.md).
 * `null` means "not found"; anything else wrong (network failure, a
 * non-404 non-OK status, unparseable JSON) still throws `ApiError`. */
export async function fetchPublishedVenue(venueId: string): Promise<PublishedVenue | null> {
  const path = `/public/venues/${encodeURIComponent(venueId)}`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`);
  } catch {
    throw new ApiError(`Could not reach the API (${path}).`);
  }

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new ApiError(`${path} failed with status ${response.status}.`);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(`${path} returned a response that wasn't valid JSON.`);
  }

  return data as PublishedVenue;
}
