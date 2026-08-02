import type { PublishedDestinationDTO } from "@/lib/api/dto";
import type { Destination } from "@/lib/domain/destination";

export function toDestination(dto: PublishedDestinationDTO): Destination {
  return {
    id: dto.id,
    name: dto.name,
    region: dto.region,
    aliases: dto.aliases ?? [],

    // API_REQUIREMENTS.md §3 — no source yet.
    venueCount: null,
  };
}
