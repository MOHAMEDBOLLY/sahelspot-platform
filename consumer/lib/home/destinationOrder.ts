import { findReferenceBySahelSpotId } from "@/lib/reference/northCoastReference";

/** Explore Destinations — Home-specific adapter over the canonical
 * `lib/reference/northCoastReference.ts`.
 *
 * This file owns no data of its own: it exists only to give
 * `HomeClient.tsx`/`DestinationCard.tsx` the small `{displayOrder,
 * kilometerMarker}` shape they render, derived by looking up each live
 * destination's linked reference entry via `findReferenceBySahelSpotId`.
 * `displayOrder` is the reference entry's `travelOrder` (the real westbound
 * driving sequence — never recomputed here); `kilometerMarker` is its
 * `roadKmStart` (real road marker, never coordinate-derived). A destination
 * with no linked reference entry gets no metadata here and falls to the
 * end of Home's rail — see `northCoastReference.ts`'s `KNOWN_GAPS`.
 */

export type DestinationGeoMetadata = {
  /** The linked reference entry's `travelOrder`. Lower runs first. */
  displayOrder: number;
  /** The linked reference entry's `roadKmStart`. Display only. */
  kilometerMarker: number;
};

/** Looks up Home's `{displayOrder, kilometerMarker}` for a live destination
 * id — `null` if it has no linked reference entry, or its entry has no KM
 * figure (e.g. a Matrouh-section entry) to display. */
export function getDestinationGeoMetadata(destinationId: string): DestinationGeoMetadata | null {
  const entry = findReferenceBySahelSpotId(destinationId);
  if (entry === null || entry.roadKmStart === null) return null;
  return { displayOrder: entry.travelOrder, kilometerMarker: entry.roadKmStart };
}

/** Sorts by the linked reference entry's `travelOrder`; a destination with
 * no linked entry falls to the end rather than disappearing or throwing —
 * `Array.prototype.sort` is stable, so such destinations keep whatever
 * relative order the API already returned them in (alphabetical, per
 * `GET /public/destinations`). Resolve the gap in `northCoastReference.ts`
 * to place one correctly instead of guessing here. */
export function sortDestinationsGeographically<T extends { id: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    const orderA = getDestinationGeoMetadata(a.id)?.displayOrder ?? Number.MAX_SAFE_INTEGER;
    const orderB = getDestinationGeoMetadata(b.id)?.displayOrder ?? Number.MAX_SAFE_INTEGER;
    return orderA - orderB;
  });
}
