import type { Venue } from "@/lib/domain/venue";

/** The UI-facing collection shape — the domain counterpart to `Venue`,
 * for `GET /public/collections/{slug}`. `venues` are full `Venue` domain
 * objects (via `toVenue`, `lib/domain/mappers/venue.ts`), not a duplicate
 * shape — a collection is just a curated, ordered list of venues the
 * Consumer already knows how to render everywhere else (`VenueCard`,
 * Venue Details). */
export type Collection = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  venues: Venue[];
};
