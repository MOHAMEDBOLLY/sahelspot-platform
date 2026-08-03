/** The UI-facing event shape — same "components never see snake_case"
 * boundary `lib/domain/venue.ts` already establishes. Events Module v1. */
export type EventPhase = "upcoming" | "live" | "ended";

export type Event = {
  id: string;
  slug: string;
  title: string;
  coverImageUrl: string | null;
  shortDescription: string | null;
  startDate: string;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  venue: { id: string; name: string } | null;
  destination: { id: string; name: string } | null;
  featured: boolean;
  ticketProvider: string | null;
  ticketUrl: string | null;
  phase: EventPhase | null;
};
