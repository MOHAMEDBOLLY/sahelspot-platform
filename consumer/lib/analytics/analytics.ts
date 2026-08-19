"use client";

import { posthog } from "./posthog";

/** The complete V1 event taxonomy — the only events this app sends. Adding a
 * new event means adding a key here first, so the name and its properties
 * stay typed and centralized instead of scattered `posthog.capture(...)`
 * calls with ad-hoc property bags. */
type EventMap = {
  page_view: {
    pathname: string;
    search: string;
  };
  search: {
    query: string;
    result_count: number;
    source: "search_page" | "recent";
  };
  venue_view: {
    venue_id: string;
    venue_name: string;
    destination: string;
    category: string;
  };
  external_link_click: {
    venue_id: string;
    venue_name: string;
    link_type: "instagram" | "whatsapp" | "phone" | "website" | "maps";
    target_domain: string | null;
  };
  favorite_add: {
    venue_id: string;
  };
  favorite_remove: {
    venue_id: string;
  };
};

/** Analytics must never break the product — every call is wrapped so a
 * PostHog outage, an ad-blocker, or `capture_pageview`/network failure never
 * surfaces to the user or interrupts navigation. */
export function capture<E extends keyof EventMap>(event: E, properties: EventMap[E]) {
  try {
    posthog.capture(event, properties);
  } catch {
    // Deliberately swallowed — see the doc comment above.
  }
}
