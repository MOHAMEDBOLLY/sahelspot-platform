import { apiGetList, apiGetOrNull } from "./client";
import type { PublishedEventDTO } from "./dto";

export function fetchEvents(): Promise<PublishedEventDTO[]> {
  return apiGetList<PublishedEventDTO>("/public/events");
}

/** Looked up by `slug`, not `id` — the Consumer route is `/events/{slug}`
 * (Events Module v1's own stable-public-slug requirement), unlike venues'
 * id-based `/venues/{id}`. */
export function fetchEvent(eventSlug: string): Promise<PublishedEventDTO | null> {
  return apiGetOrNull<PublishedEventDTO>(`/public/events/${encodeURIComponent(eventSlug)}`);
}
