/** UI-facing destination shape — see docs/consumer/ARCHITECTURE.md §3. */
export type Destination = {
  id: string;
  name: string;
  region: string;
  aliases: string[];
  coverImageUrl: string | null;

  /** API_REQUIREMENTS.md §3 — no source yet ("124 Places" on DestinationCard). */
  venueCount: number | null;
};

/** Location Context Label refinement — the small "X Area" badge a venue
 * card shows when a venue appears in a Destination-related list (Venue
 * Details' "Similar Experiences", Search's `?destination=` results) but
 * actually belongs to a *different* destination in the same real-world
 * area — e.g. Marassi and Hacienda Bay are both `region: "Sidi Abdelrahman
 * Area"` (Studio's own existing grouping; already used by
 * `northCoastReference.ts`'s own `area` field for the same cluster).
 *
 * Reuses `Destination.region` as the sole classification signal —
 * deliberately no new proximity/radius/geometry computation, no
 * coordinates read here. `region` is the one field the backend already
 * populates for exactly this purpose (see `DESTINATION_REGIONS` /
 * `api/app/db/models.py`).
 *
 * Returns `null` (no badge) whenever:
 * - there's no context destination (the list isn't destination-scoped), or
 * - the venue's own destination *is* the context destination (Case 1 —
 *   just show its name, no badge), or
 * - the venue's destination isn't found, or its region doesn't match the
 *   context destination's region (unrelated — showing "X Area" here would
 *   be a false, invented connection). */
export function areaLabel(
  venueDestinationId: string,
  contextDestination: Destination | null,
  allDestinations: readonly Destination[],
): string | null {
  if (contextDestination === null) return null;
  if (venueDestinationId === contextDestination.id) return null;
  const venueDestination = allDestinations.find((d) => d.id === venueDestinationId);
  if (!venueDestination || venueDestination.region !== contextDestination.region) return null;
  return `${contextDestination.name} Area`;
}
