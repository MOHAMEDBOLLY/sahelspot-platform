/** UI-facing destination shape — see docs/consumer/ARCHITECTURE.md §3. */
export type Destination = {
  id: string;
  name: string;
  region: string;
  aliases: string[];

  /** API_REQUIREMENTS.md §3 — no source yet ("124 Places" on DestinationCard). */
  venueCount: number | null;
};
