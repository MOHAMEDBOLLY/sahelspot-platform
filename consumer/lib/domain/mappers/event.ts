import type { PublishedEventDTO } from "@/lib/api/dto";
import type { Event } from "@/lib/domain/event";

/** DTO -> Domain. `ticket_provider`/`external_event_id` intentionally have
 * no domain-model field of their own beyond `ticketProvider` — nothing in
 * Consumer's UI needs `external_event_id` (it's a Studio/ticket-provider
 * matching detail), so it's dropped here rather than carried through
 * unused. */
export function toEvent(dto: PublishedEventDTO): Event {
  return {
    id: dto.id,
    slug: dto.slug,
    title: dto.title,
    coverImageUrl: dto.cover_image_url,
    shortDescription: dto.short_description,
    startDate: dto.start_date,
    endDate: dto.end_date,
    startTime: dto.start_time,
    endTime: dto.end_time,
    venue: dto.venue,
    destination: dto.destination,
    featured: dto.featured,
    ticketProvider: dto.ticket_provider,
    ticketUrl: dto.ticket_url,
    phase: dto.phase,
  };
}
