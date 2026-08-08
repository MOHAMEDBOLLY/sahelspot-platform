import type { PublishedCollectionDTO } from "@/lib/api/dto";
import type { Collection } from "@/lib/domain/collection";
import { toVenue } from "@/lib/domain/mappers/venue";

/** DTO -> Domain, mirroring `toVenue`'s role for venues. `venues` reuses
 * that same mapper rather than re-deriving venue-shape logic here — a
 * collection's venues are ordinary venues, not a distinct wire shape. */
export function toCollection(dto: PublishedCollectionDTO): Collection {
  return {
    id: dto.id,
    slug: dto.slug,
    name: dto.name,
    description: dto.description,
    venues: dto.venues.map(toVenue),
  };
}
