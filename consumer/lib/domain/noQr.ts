/** The UI-facing No QR shape — same "components never see snake_case"
 * boundary `lib/domain/event.ts` already establishes. No QR Independent
 * Entity: a Walk or a Mall, each holding places that are either an
 * existing Venue (by reference) or a standalone place with no Venue
 * record. Never a `VenueCategory`, never a tag — an independent discovery
 * surface, like Events. */
export type NoQrAreaType = "Walk" | "Mall";

export type NoQrPlace = {
  id: number;
  /** Set only for a standalone place (no linked Venue). */
  name: string | null;
  /** Set only when this place links an existing Venue — `null` for a
   * standalone place. Consumer must not fabricate a Venue for the
   * `name`-only case. */
  venue: { id: string; name: string } | null;
};

export type NoQrArea = {
  id: number;
  name: string;
  type: NoQrAreaType;
  places: NoQrPlace[];
};
